#!/usr/bin/env bash
# extract-frames.sh
# Extract video frames to WebP for a transition segment.
# Usage:
#   bash scripts/extract-frames.sh --input <video> --id <transitionId> [--scale 1280:720|480:854]
#
# Examples:
#   bash scripts/extract-frames.sh --input ~/videos/t1.mp4 --id t1
#   bash scripts/extract-frames.sh --input ~/videos/t1-mobile.mp4 --id t1 --scale 480:854
#
# Output: public/frames/desktop/<id>/frame_0001.webp … (or frames/mobile/ for 9:16)
# After extracting, update src/config/segments.ts:
#   Find the transition entry, set mode:'frames', framesDir:'/frames/desktop/<id>', frameCount:<actual count>

set -euo pipefail

INPUT=""
ID=""
SCALE="1280:720"

while [[ $# -gt 0 ]]; do
  case $1 in
    --input) INPUT="$2"; shift 2 ;;
    --id)    ID="$2";    shift 2 ;;
    --scale) SCALE="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$INPUT" || -z "$ID" ]]; then
  echo "Usage: bash extract-frames.sh --input <video> --id <transitionId> [--scale 1280:720]"
  exit 1
fi

# Determine output path based on scale
if [[ "$SCALE" == "480:854" ]]; then
  OUT_DIR="public/frames/mobile/${ID}"
else
  OUT_DIR="public/frames/desktop/${ID}"
fi

mkdir -p "$OUT_DIR"

echo "Extracting: $INPUT → $OUT_DIR (scale: $SCALE)"

ffmpeg -i "$INPUT" \
  -vf "scale=${SCALE}:flags=lanczos" \
  -c:v libwebp \
  -quality 85 \
  -compression_level 4 \
  -lossless 0 \
  -preset photo \
  -an \
  "${OUT_DIR}/frame_%04d.webp"

COUNT=$(ls "${OUT_DIR}"/frame_*.webp 2>/dev/null | wc -l)
echo ""
echo "Done. $COUNT frames → ${OUT_DIR}"
echo ""
echo "Now update src/config/segments.ts:"
echo "  id: '${ID}', mode: 'frames', framesDir: '/${OUT_DIR}', frameCount: ${COUNT}"
