#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let ffmpegPath = 'ffmpeg';
try {
  const ffmpegStatic = require('ffmpeg-static');
  ffmpegPath = ffmpegStatic;
  console.log(`✓ ffmpeg-static: ${ffmpegPath}`);
} catch (_) {
  console.log(`ℹ using ffmpeg from PATH`);
}

const args = process.argv.slice(2);
const frameRate = parseInt(args[0]) || 16;

const SCENES = [
  {
    video: 'public/frames/mobile/1-escena-mobile.mp4',
    outDir: 'public/frames/mobile/escena-1',
  },
  {
    video: 'public/frames/mobile/2-escena-mobile.mp4',
    outDir: 'public/frames/mobile/escena-2',
  },
  {
    video: 'public/frames/mobile/3-escena-mobile.mp4',
    outDir: 'public/frames/mobile/escena-3',
  },
];

const counts = {};

for (const scene of SCENES) {
  console.log(`\nExtracting: ${scene.video}`);

  if (!fs.existsSync(scene.video)) {
    console.error(`✗ Video not found: ${scene.video}`);
    process.exit(1);
  }

  // Clean existing frames
  if (fs.existsSync(scene.outDir)) {
    const existing = fs.readdirSync(scene.outDir).filter(f => f.endsWith('.webp'));
    for (const f of existing) fs.unlinkSync(path.join(scene.outDir, f));
    console.log(`  Cleaned ${existing.length} old frames`);
  } else {
    fs.mkdirSync(scene.outDir, { recursive: true });
    console.log(`  Created: ${scene.outDir}`);
  }

  const outputPattern = path.join(scene.outDir, 'frame_%04d.webp');
  // scale to 480x854 exactly; pad if source aspect differs
  const cmd = `"${ffmpegPath}" -i "${scene.video}" -r ${frameRate} -vf "scale=480:854:force_original_aspect_ratio=decrease,pad=480:854:(ow-iw)/2:(oh-ih)/2" -c:v libwebp -q:v 80 -an "${outputPattern}" -y`;

  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`✗ Extraction failed for ${scene.video}:`, err.message);
    process.exit(1);
  }

  const frames = fs.readdirSync(scene.outDir).filter(f => f.endsWith('.webp'));
  counts[scene.outDir] = frames.length;
  console.log(`✓ ${scene.outDir}: ${frames.length} frames`);
}

console.log('\n── Summary ──────────────────────────────────');
for (const [dir, count] of Object.entries(counts)) {
  const id = dir.split('/').pop();
  console.log(`  ${id}: ${count} frames  →  frameCountMobile: ${count}`);
}
console.log('\nUpdate segments.ts t1/t2/t3 frameCountMobile with these values.');
