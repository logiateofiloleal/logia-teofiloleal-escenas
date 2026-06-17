'use client';

import { useEffect, useRef } from 'react';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import styles from './S4AtmosOverlay.module.css';

// Scrim-only overlay — no blur, no backdrop-filter.
// Provides a gentle darkening of the canvas during the Teófilo segment.
const SCRIM_OPACITY = 0.28;

const BG_EDGE   = `rgba(0,0,0,${(SCRIM_OPACITY * 0.82).toFixed(2)})`;
const BACKGROUND = [
  `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,.14) 52%, ${BG_EDGE} 100%)`,
  `rgba(0,0,0,${SCRIM_OPACITY})`,
].join(', ');

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function S4AtmosOverlay() {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return register((state: SceneState) => {
      let opacity = 0;
      const lp = state.direction === 1 ? state.progress : 1 - state.progress;

      if (state.playState === 'idle' && state.station === 2) {
        // s3 idle — Teófilo visible, scrim at full
        opacity = 1;
      } else if (state.playState === 'playing') {
        if (state.transitionIdx === 1) {
          // t2 arriving at s3 — scrim builds in sync with Teófilo entry (last ~5%)
          opacity = ss(0.82, 1.0, lp);
        } else if (state.transitionIdx === 2) {
          // t3 leaving s3 — dissolves in sync with TeofiloCopy (fadeOutStart→fadeOutEnd 0.25→0.50)
          // Canvas is clean from lp 0.50 (~4750ms) well before the door becomes dominant
          opacity = 1 - ss(0.25, 0.50, lp);
        }
      }

      el.style.opacity = String(opacity);
    });
  }, [register]);

  return (
    <div
      ref={elRef}
      className={styles.atmos}
      style={{ background: BACKGROUND }}
      aria-hidden="true"
    />
  );
}
