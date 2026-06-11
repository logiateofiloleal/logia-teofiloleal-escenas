/**
 * process-stills.mjs
 * Converts the 5 source JPEG frames (1672×941) to 1280×720 WebP.
 * Run once after cloning: node scripts/process-stills.mjs
 *
 * Source: ../assets/escenas/frame-{1-5}.jpg
 * Output: public/frames/desktop/frame-{1-5}.webp
 */

import sharp from 'sharp';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dir, '..');
const SRC    = join(ROOT, '..', 'assets', 'escenas'); // ../assets/escenas relative to next/
const DEST   = join(ROOT, 'public', 'frames', 'desktop');
const MOBILE = join(ROOT, 'public', 'frames', 'mobile'); // placeholder for future 9:16 assets

mkdirSync(DEST,   { recursive: true });
mkdirSync(MOBILE, { recursive: true });

console.log(`Source: ${SRC}`);
console.log(`Output: ${DEST}`);

for (let n = 1; n <= 5; n++) {
  const src  = join(SRC, `frame-${n}.jpg`);
  const dest = join(DEST, `frame-${n}.webp`);

  if (!existsSync(src)) {
    console.warn(`⚠ Not found: ${src}`);
    continue;
  }

  await sharp(src)
    .resize(1280, 720, { fit: 'cover', position: 'center' })
    .webp({ quality: 85 })
    .toFile(dest);

  console.log(`✓ frame-${n}.webp`);
}

// Note on mobile assets:
// When native 9:16 frames are ready, process them to 480×854 WebP
// and place them in public/frames/mobile/frame-{n}.webp
// Then update frameLoader.ts to swap the base path for isMobile.
console.log('\nDone. Mobile folder created at public/frames/mobile/ — awaiting 9:16 source assets.');
