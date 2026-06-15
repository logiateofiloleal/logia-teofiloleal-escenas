'use client';

import { useEffect, useRef } from 'react';
import { useSceneSnap } from '@/context/SceneSnap';
import styles from './ScrollHint.module.css';

export default function ScrollHint() {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    return register(state => {
      // Visible only when idle at El Umbral (station 0)
      el.style.opacity = state.station === 0 && state.playState === 'idle' ? '1' : '0';
    });
  }, [register]);

  return (
    <div ref={elRef} className={styles.hint} aria-hidden="true">
      <span>Desliza</span>
      <div className={styles.line} />
    </div>
  );
}
