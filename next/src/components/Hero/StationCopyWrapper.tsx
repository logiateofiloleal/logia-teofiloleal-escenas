'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useScrollEngine } from '@/context/ScrollEngine';
import styles from './Hero.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

interface Props {
  stationId: string;     // 's1' … 's5'
  stationIndex: number;  // 0-4
  align: 'center' | 'right';
  wide?: boolean;        // Escena 2 three-column layout
  minimal?: boolean;     // Escena 5
  children: ReactNode;
}

export default function StationCopyWrapper({
  stationId,
  stationIndex,
  align,
  wide = false,
  minimal = false,
  children,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useScrollEngine();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return register(state => {
      const active = state.segmentId === stationId && state.type === 'station';
      let opacity = 0;

      if (active) {
        const lp = state.localProgress;
        if (stationIndex === 0) {
          // S1: always visible, only fades OUT
          opacity = 1 - ss(0.75, 1.0, lp);
        } else {
          const fadeIn  = ss(0.0, 0.25, lp);
          const fadeOut = 1 - ss(0.75, 1.0, lp);
          opacity = Math.min(fadeIn, fadeOut);
        }
      }

      el.style.opacity      = String(opacity);
      el.style.pointerEvents = opacity > 0.75 ? 'auto' : 'none';

      // Position animation: slides up slightly as opacity increases
      const yOffset = -44 + opacity * -6; // -44% → -50%

      if (align === 'center') {
        el.style.transform = `translateX(-50%) translateY(${yOffset}%)`;
      } else {
        el.style.transform = `translateY(${yOffset}%)`;
      }
    });
  }, [register, stationId, stationIndex, align]);

  const cls = [
    styles.copy,
    align === 'center' ? styles.centered : '',
    wide    ? styles.wide    : '',
    minimal ? styles.minimal : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={elRef} className={cls} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
