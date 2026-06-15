'use client';

import { useEffect, useRef } from 'react';
import { useScrollEngine } from '@/context/ScrollEngine';
import styles from './CinematicOverlay.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function CinematicOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const pulseRef   = useRef<HTMLDivElement>(null);
  const { register } = useScrollEngine();

  useEffect(() => {
    return register(state => {
      const overlay = overlayRef.current;
      const pulse   = pulseRef.current;

      // Exit animation — matches UmbralOverlay: lp 0.82→1.0 of t1
      if (overlay) {
        if (state.segmentId === 't1') {
          const exit = ss(0.82, 1.0, state.localProgress);
          overlay.style.opacity = String(1 - exit);
        } else {
          overlay.style.opacity = '1';
        }
      }

      // Pulse: golden glow driven by global progress
      if (pulse) {
        const gp    = state.globalProgress;
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
