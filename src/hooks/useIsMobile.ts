'use client';

import { useState, useEffect } from 'react';

// Read ONCE at mount — intentionally NOT reactive to resize.
// Changing viewport mid-session would force canvas/frame reload; avoid that.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);
  return isMobile;
}
