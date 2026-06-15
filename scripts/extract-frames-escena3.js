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

const videoPath = 'public/assets/escena-3-desktop.mp4';
const desktopDir = 'public/frames/escena-3-desktop';

console.log(`\nExtracting: ${videoPath}`);
console.log(`FPS: ${frameRate}`);

if (!fs.existsSync(videoPath)) {
  console.error(`✗ Video not found: ${videoPath}`);
  process.exit(1);
}

if (!fs.existsSync(desktopDir)) {
  fs.mkdirSync(desktopDir, { recursive: true });
  console.log(`✓ Created: ${desktopDir}`);
}

console.log(`\nDESKTOP (1280×720)...`);
try {
  const outputPattern = path.join(desktopDir, 'frame_%04d.webp');
  const cmd = `"${ffmpegPath}" -i "${videoPath}" -r ${frameRate} -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" -c:v libwebp -q:v 80 -an "${outputPattern}" -y`;

  execSync(cmd, { stdio: 'inherit' });

  const frames = fs.readdirSync(desktopDir).filter(f => f.endsWith('.webp'));
  console.log(`✓ DESKTOP: ${frames.length} frames`);
  console.log(`\nUpdate segments.ts t3:`);
  console.log(`  framesDir: '/frames/escena-3-desktop',`);
  console.log(`  frameCount: ${frames.length},`);
} catch (err) {
  console.error(`✗ Extraction failed:`, err.message);
  process.exit(1);
}
