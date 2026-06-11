'use client';

import { useEffect, useRef } from 'react';
import { useScrollEngine } from '@/context/ScrollEngine';
import styles from './CinematicOverlay.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function CinematicOverlay() {
  const pulseRef = useRef<HTMLDivElement>(null);
  const { register } = useScrollEngine();

  useEffect(() => {
    return register(state => {
      const el = pulseRef.current;
      if (!el) return;
      const gp = state.globalProgress;
      const power = ss(0.48, 0.9, gp);
      el.style.opacity   = String(power * 0.75);
      el.style.transform = `scale(${0.95 + power * 0.18})`;
    });
  }, [register]);

  return (
    <>
      <div className={styles.overlay} aria-hidden="true" />
      <div ref={pulseRef} className={styles.pulse} aria-hidden="true" />
    </>
  );
}
