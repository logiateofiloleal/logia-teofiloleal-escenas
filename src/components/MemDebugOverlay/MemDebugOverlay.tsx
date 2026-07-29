'use client';

import { useEffect, useState } from 'react';
import { getLiveBytes, getLiveBitmaps } from '@/lib/frameLoader';
import styles from './MemDebugOverlay.module.css';

// Live view of Canvas.tsx's frame-loader memory accounting — enable with
// ?memdebug=1 to verify the memory window (see Canvas.tsx enforceMemoryWindow)
// actually keeps decoded frames bounded while scrubbing through transitions,
// instead of guessing from DevTools' heap snapshot.
function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

export default function MemDebugOverlay() {
  const [enabled, setEnabled]   = useState(false);
  const [bytes, setBytes]       = useState(0);
  const [bitmaps, setBitmaps]   = useState(0);

  useEffect(() => {
    setEnabled(new URLSearchParams(window.location.search).get('memdebug') === '1');
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      setBytes(getLiveBytes());
      setBitmaps(getLiveBitmaps());
    }, 500);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className={styles.overlay} aria-hidden="true">
      {`live bitmaps: ${bitmaps}\nlive memory:  ${mb(bytes)} MB`}
    </div>
  );
}
