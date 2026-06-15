'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import styles from './Hero.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

interface Props {
  transitionIdx: number;  // e.g. 2 for t3
  children: ReactNode;
}

export default function TransitionCopyWrapper({
  transitionIdx,
  children,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return register((state: SceneState) => {
      let opacity = 0;
      const lp = state.direction === 1 ? state.progress : 1 - state.progress;

      if (state.playState === 'playing' && state.transitionIdx === transitionIdx) {
        // Fade in: lp 0→0.05, fade out: lp 0.95→1.0
        const fadeIn = ss(0, 0.05, lp);
        const fadeOut = 1 - ss(0.95, 1.0, lp);
        opacity = Math.min(fadeIn, fadeOut);
      }

      el.style.opacity = String(opacity);
      el.style.pointerEvents = opacity > 0.75 ? 'auto' : 'none';
    });
  }, [register, transitionIdx]);

  return (
    <div ref={elRef} className={`${styles.copy} ${styles.centered}`} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
