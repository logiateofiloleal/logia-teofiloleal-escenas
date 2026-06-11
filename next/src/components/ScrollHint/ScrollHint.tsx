'use client';

import { useEffect, useRef } from 'react';
import { useScrollEngine } from '@/context/ScrollEngine';
import styles from './ScrollHint.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function ScrollHint() {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useScrollEngine();

  useEffect(() => {
    return register(state => {
      const el = elRef.current;
      if (!el) return;
      // Only relevant during first station
      if (state.segmentId !== 's1' || state.type !== 'station') {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = String(1 - ss(0.02, 0.12, state.localProgress));
    });
  }, [register]);

  return (
    <div ref={elRef} className={styles.hint} aria-hidden="true">
      <span>Desliza</span>
      <div className={styles.line} />
    </div>
  );
}
