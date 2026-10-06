// Packs the frame sequences for delivery.
//
//   node scripts/build-frame-packs.mjs
//
// Reads  assets-src/frames/v1/<tier>/escena-N/frame_NNNN.webp   (the source of truth; not deployed)
// Writes public/frames/v1/<tier>/escena-N/pack-<k>.bin           (WebP files concatenated as-is, NOT re-encoded)
//        public/frames/v1/<tier>/escena-N/frame_0001.webp + last  (the first/last stills the preloader and the
//                                                                 resting stations draw — see segments.ts)
//        src/config/framePacks.generated.ts                       (index: which frame sits where in which pack)
//
// Why: the site used to download 130 tiny files per scene and tier (390 requests
// per visitor), and with ~0.7 s of latency per request the connection sat idle.
// A pack is one request for ~16-18 frames.
//
// Packs follow the loader's coarse-to-fine passes (src/lib/frameLoader.ts):
//   level 0  every 8th frame + the last one   (1 pack, ~18 frames)
//   level 1  the remaining every-4th frames    (1 pack, ~16)
//   level 2  the remaining every-2nd frames    (split in packs of ≤16, in frame order)
//   level 3  all the others                    (split in packs of ≤16, in frame order)
// Splitting the fine passes by frame order keeps a pack small and makes it cover a
// contiguous stretch of the scene, so "the frame the canvas is waiting for" maps to a
// ~0.5 MB pack instead of a multi-MB one.
//
// Versioning: /frames/v1/ is served with `immutable` (netlify.toml). Regenerating the
// frames means a NEW version folder (v2) — never overwrite v1. Change VERSION below
// (and the paths in segments.ts, next.config.ts and netlify.toml) when you do.
import { promises as fs } from 'node:fs';
import path from 'node:path';

const VERSION = 'v1';
const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'assets-src', 'frames', VERSION);
const OUT = path.join(ROOT, 'public', 'frames', VERSION);
const INDEX_TS = path.join(ROOT, 'src', 'config', 'framePacks.generated.ts');
const STRIDES = [8, 4, 2, 1];
const MAX_FRAMES_PER_PACK = 16;

// Same pass/level split as FrameLoader (kept in sync by hand: it is 10 lines).
function passes(count) {
  const seen = new Set();
  return STRIDES.map((stride, lvl) => {
    const idx = [];
    for (let i = 0; i < count; i += stride) if (!seen.has(i)) { seen.add(i); idx.push(i); }
    if (lvl === 0 && count > 0 && !seen.has(count - 1)) { seen.add(count - 1); idx.push(count - 1); }
    return idx;
  });
}

const chunk = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, (i + 1) * n));

const index = {};
let totalPacks = 0;
let totalBytes = 0;

for (const tier of (await fs.readdir(SRC)).sort()) {
  for (const scene of (await fs.readdir(path.join(SRC, tier))).sort()) {
    const srcDir = path.join(SRC, tier, scene);
    const outDir = path.join(OUT, tier, scene);
    const files = (await fs.readdir(srcDir)).filter((f) => /^frame_\d{4}\.webp$/.test(f)).sort();
    const count = files.length;
    if (count === 0) continue;
    // frame_0001 ↔ index 0 …: the loader and segments.ts both count from 1 in file names.
    files.forEach((f, i) => {
      if (f !== `frame_${String(i + 1).padStart(4, '0')}.webp`) throw new Error(`${srcDir}: gap before ${f}`);
    });

    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });

    const packs = [];
    const lists = passes(count);
    for (let level = 0; level < lists.length; level++) {
      const groups = level <= 1 ? [lists[level]] : chunk(lists[level], MAX_FRAMES_PER_PACK);
      for (const group of groups) {
        if (group.length === 0) continue;
        const k = packs.length;
        const bufs = [];
        const frames = [];
        let offset = 0;
        for (const i of group) {
          const buf = await fs.readFile(path.join(srcDir, files[i]));
          frames.push([i, offset, buf.length]);
          bufs.push(buf);
          offset += buf.length;
        }
        await fs.writeFile(path.join(outDir, `pack-${k}.bin`), Buffer.concat(bufs));
        packs.push({ url: `/frames/${VERSION}/${tier}/${scene}/pack-${k}.bin`, level, frames });
        totalBytes += offset;
      }
    }
    totalPacks += packs.length;

    // Stills the page uses directly (preloader, arrival at a station).
    for (const f of [files[0], files[count - 1]]) await fs.copyFile(path.join(srcDir, f), path.join(outDir, f));

    index[`/frames/${VERSION}/${tier}/${scene}`] = packs;
    console.log(`${tier}/${scene}: ${count} frames → ${packs.length} packs (${packs.map((p) => p.frames.length).join('+')})`);
  }
}

const body = Object.entries(index)
  .map(([dir, packs]) => {
    const rows = packs
      .map((p) => `    { url: '${p.url}', level: ${p.level}, frames: [${p.frames.map((f) => `[${f.join(',')}]`).join(',')}] },`)
      .join('\n');
    return `  '${dir}': [\n${rows}\n  ],`;
  })
  .join('\n');

await fs.writeFile(
  INDEX_TS,
  `// GENERATED by scripts/build-frame-packs.mjs — DO NOT EDIT BY HAND.
// Regenerate with: node scripts/build-frame-packs.mjs
//
// For each frame directory (as written in segments.ts): its packs, in load order.
// frames: [frame index (0-based), byte offset in the pack, byte length].

export interface FramePack {
  url: string;
  /** Pass: 0 = every 8th frame, 1 = every 4th, 2 = every 2nd, 3 = the rest. */
  level: 0 | 1 | 2 | 3;
  frames: ReadonlyArray<readonly [number, number, number]>;
}

export const FRAME_PACKS: Readonly<Record<string, readonly FramePack[]>> = {
${body}
};
`,
);
// Read every pack back and compare each frame with its source file; a pack that
// does not round-trip byte for byte must never ship. (scripts/verify-frame-packs.mjs
// repeats this and also replays the packs through the streaming assembler.)
for (const [dir, packs] of Object.entries(index)) {
  for (const pack of packs) {
    const bin = await fs.readFile(path.join(ROOT, 'public', pack.url));
    for (const [i, offset, len] of pack.frames) {
      const original = await fs.readFile(path.join(ROOT, 'assets-src', dir.replace(/^\//, ''), `frame_${String(i + 1).padStart(4, '0')}.webp`));
      if (!bin.subarray(offset, offset + len).equals(original)) throw new Error(`${pack.url}: frame ${i} does not match its source`);
    }
  }
}

console.log(`\n${totalPacks} packs, ${(totalBytes / 1048576).toFixed(1)} MB → ${path.relative(ROOT, INDEX_TS)}`);
