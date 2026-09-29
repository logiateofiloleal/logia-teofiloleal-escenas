'use client';

import { useState, useEffect } from 'react';
import type { FrameTier } from '@/config/segments';

export type { FrameTier };

// Which frame sequence (and canvas backing size) a visitor gets:
//   mobile  480×854 (9:16) — any portrait viewport (phones, tablets upright)
//   tablet  960×540 (16:9) — landscape on a touch-primary device (tablets,
//                            phones turned sideways)
//   desktop 1280×720 (16:9) — landscape with a mouse/trackpad, or a touch
//                             screen larger than any tablet
// The canvas is shown with object-fit: cover, so each tier only needs the
// right orientation — the viewport's exact aspect ratio is handled by a
// small crop, never by stretching.
//
// Tablet exists for memory, not framing: desktop frames decode to ~457MB
// per transition, tablet frames to ~257MB — and phones/tablets hold two
// transitions at once (see Canvas.tsx memory budgets).

// Longest viewport side (CSS px) still treated as a tablet in landscape.
// Covers iPad Pro 13" (1376×1032) and large Android tablets.
const TABLET_MAX_SIDE = 1440;

export function readFrameTier(): FrameTier {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h > w) return 'mobile';
  const touchPrimary = window.matchMedia('(pointer: coarse)').matches;
  if (touchPrimary && Math.max(w, h) <= TABLET_MAX_SIDE) return 'tablet';
  return 'desktop';
}

// Read ONCE at mount — intentionally NOT reactive to resize/rotation.
// Changing tier mid-session would force a canvas/frame reload; avoid that.
// Starts as 'desktop' on the server and first client render; Canvas.tsx
// reads readFrameTier() directly where it can't wait for this to settle.
export function useFrameTier(): FrameTier {
  const [tier, setTier] = useState<FrameTier>('desktop');
  useEffect(() => {
    setTier(readFrameTier());
  }, []);
  return tier;
}
