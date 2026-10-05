#!/usr/bin/env node
'use strict';

// Extracts the tablet tier (960×540) frame sequences straight from the
// original source videos (3828×2164 masters). Extracting from the masters,
// rather than downscaling the committed 1280×720 webp frames, avoids a
// second lossy generation (~38 dB vs ~32 dB PSNR against a lossless
// reference).
//
// The masters are not stored in this repo — pass their folder:
//   node scripts/extract-frames-tablet.js --videos "<dir with the .mp4 files>" [--fps 16]
//
// Same frame rate as the desktop/mobile extraction (16 fps → 130 frames per
// 8.04 s clip), so frame N of every tier shows the same moment.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let ffmpegPath = 'ffmpeg';
try {
  ffmpegPath = require('ffmpeg-static');
  console.log(`✓ ffmpeg-static: ${ffmpegPath}`);
} catch (_) {
  console.log(`ℹ using ffmpeg from PATH`);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const videosDir = arg('videos');
const frameRate = parseInt(arg('fps', '16'), 10);
if (!videosDir) {
  console.error('✗ Missing --videos "<dir>" (folder with frames-1.mp4, escena-2-desktop.mp4, escena-3-desktop.mp4)');
  process.exit(1);
}

const SCENES = [
  { video: 'frames-1.mp4',         outDir: 'assets-src/frames/v1/tablet/escena-1' },
  { video: 'escena-2-desktop.mp4', outDir: 'assets-src/frames/v1/tablet/escena-2' },
  { video: 'escena-3-desktop.mp4', outDir: 'assets-src/frames/v1/tablet/escena-3' },
];

const counts = {};

for (const scene of SCENES) {
  const video = path.join(videosDir, scene.video);
  console.log(`\nExtracting: ${video}`);

  if (!fs.existsSync(video)) {
    console.error(`✗ Video not found: ${video}`);
    process.exit(1);
  }

  if (fs.existsSync(scene.outDir)) {
    const existing = fs.readdirSync(scene.outDir).filter(f => f.endsWith('.webp'));
    for (const f of existing) fs.unlinkSync(path.join(scene.outDir, f));
    console.log(`  Cleaned ${existing.length} old frames`);
  } else {
    fs.mkdirSync(scene.outDir, { recursive: true });
    console.log(`  Created: ${scene.outDir}`);
  }

  const outputPattern = path.join(scene.outDir, 'frame_%04d.webp');
  // Masters are 1.769:1, not exactly 16:9 — scale to cover 960×540 and crop
  // the ~1px overflow: no stretching and no padding bars.
  const vf = 'scale=960:540:force_original_aspect_ratio=increase:flags=lanczos,crop=960:540';
  const cmd = `"${ffmpegPath}" -hide_banner -loglevel error -i "${video}" -r ${frameRate} -vf "${vf}" -c:v libwebp -q:v 80 -an "${outputPattern}" -y`;

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`✗ Extraction failed for ${video}:`, err.message);
    process.exit(1);
  }

  const frames = fs.readdirSync(scene.outDir).filter(f => f.endsWith('.webp'));
  counts[scene.outDir] = frames.length;
  console.log(`✓ ${scene.outDir}: ${frames.length} frames`);
}

console.log('\n── Summary ──────────────────────────────────');
for (const [dir, count] of Object.entries(counts)) {
  console.log(`  ${dir.split('/').pop()}: ${count} frames  →  frameCountTablet: ${count}`);
}
