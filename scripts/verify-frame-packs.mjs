// Byte-for-byte check of the frame packs against the source WebP files.
//
//   node scripts/verify-frame-packs.mjs
//
// For every pack in src/config/framePacks.generated.ts it
//   1. slices the pack file at the indexed offsets and compares with the
//      original assets-src/frames/v1/<tier>/escena-N/frame_NNNN.webp, and
//   2. replays the pack through PackAssembler (the streaming path the browser
//      uses) with randomly sized chunks — from a few bytes up to ~200 KB — and
//      compares every frame it hands out, checking each one is handed out
//      exactly once and only after its last byte arrived.
// Exits non-zero on any difference. Runs the TypeScript sources as they are
// (Node ≥ 22.18 strips the types), no build step or extra dependency.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FRAME_PACKS } from '../src/config/framePacks.generated.ts';
import { PackAssembler } from '../src/lib/packStream.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

// Small deterministic PRNG so a failure can be reproduced.
let seed = 123456789;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

let packs = 0;
let frames = 0;
const failures = [];

for (const [dir, list] of Object.entries(FRAME_PACKS)) {
  const srcDir = path.join(ROOT, 'assets-src', dir.replace(/^\//, ''));
  for (const pack of list) {
    packs++;
    const bin = await fs.readFile(path.join(ROOT, 'public', pack.url));
    const expectedLength = Math.max(...pack.frames.map(([, off, len]) => off + len));
    if (bin.length !== expectedLength) failures.push(`${pack.url}: file is ${bin.length} bytes, index says ${expectedLength}`);

    const original = new Map();
    for (const [i] of pack.frames) {
      original.set(i, await fs.readFile(path.join(srcDir, `frame_${String(i + 1).padStart(4, '0')}.webp`)));
    }

    // 1. plain slices
    for (const [i, off, len] of pack.frames) {
      frames++;
      if (!bin.subarray(off, off + len).equals(original.get(i))) failures.push(`${pack.url}: frame ${i} differs (slice)`);
    }

    // 2. streamed in random chunks
    const asm = new PackAssembler(pack.frames, bin.length);
    const handed = new Map();
    let pos = 0;
    while (pos < bin.length) {
      const size = Math.min(bin.length - pos, 1 + Math.floor(rand() ** 3 * 200_000));
      for (const f of asm.push(new Uint8Array(bin.subarray(pos, pos + size)))) {
        if (handed.has(f.index)) failures.push(`${pack.url}: frame ${f.index} handed out twice`);
        const [, off, len] = pack.frames.find(([i]) => i === f.index);
        if (off + len > pos + size) failures.push(`${pack.url}: frame ${f.index} handed out before its last byte`);
        const got = Buffer.from(await f.blob.arrayBuffer());
        if (!got.equals(original.get(f.index))) failures.push(`${pack.url}: frame ${f.index} differs (stream)`);
        handed.set(f.index, true);
      }
      pos += size;
    }
    if (!asm.complete || handed.size !== pack.frames.length) failures.push(`${pack.url}: stream ended with ${handed.size}/${pack.frames.length} frames`);
  }
}

if (failures.length) {
  console.error(`${failures.length} problem(s):\n  ${failures.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}
console.log(`OK: ${packs} packs, ${frames} frames identical to the sources (plain slices and streamed in random chunks).`);
