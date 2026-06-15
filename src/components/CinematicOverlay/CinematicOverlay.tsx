'use client';

import { useEffect, useRef } from 'react';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import styles from './CinematicOverlay.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function CinematicOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const pulseRef   = useRef<HTMLDivElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    return register((state: SceneState) => {
      const overlay = overlayRef.current;
      const pulse   = pulseRef.current;

      // globalProgress proxy: 0 (s1) → 1 (s5), continuous across transitions
      const gp = state.playState === 'playing'
        ? (Math.min(state.station, state.target) + state.progress) / 4
        : state.station / 4;

      if (overlay) {
        if (state.transitionIdx === 0 && state.direction === 1) {
          const lp   = state.progress;
          const exit = ss(0.85, 1.0, lp);
          overlay.style.opacity = String(1 - exit);
        } else {
          overlay.style.opacity = '1';
        }
      }

      // Golden pulse: grows with globalProgress
      if (pulse) {
        const power = ss(0.48, 0.9, gp);
        pulse.style.opacity   = String(power * 0.75);
        pulse.style.transform = `scale(${0.95 + power * 0.18})`;
      }
    });
  }, [register]);

  return (
    <>
      <div ref={overlayRef} className={styles.overlay} aria-hidden="true" />
      <div ref={pulseRef}   className={styles.pulse}   aria-hidden="true" />
    </>
  );
}
