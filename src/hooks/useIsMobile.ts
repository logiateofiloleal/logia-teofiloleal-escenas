'use client';

import { useState, useEffect } from 'react';

// Tablets (portrait and landscape) are routed to the mobile (480×854) frame
// tier, not desktop (1280×720): a tablet decoding+holding desktop-sized
// ImageBitmaps has roughly 3x the RAM/CPU cost of the mobile tier for a
// screen that isn't meaningfully sharper at that size. Single source of
// truth — also read directly (not via this hook) by Canvas.tsx's initial
// preload effect, which runs before this hook's state settles.
export const MOBILE_BREAKPOINT = 1024;

// Read ONCE at mount — intentionally NOT reactive to resize.
// Changing viewport mid-session would force canvas/frame reload; avoid that.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
  }, []);
  return isMobile;
}
