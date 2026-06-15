'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import styles from './Hero.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

interface Props {
  stationIndex: number;  // 1-4, matches SceneSnap station number
  align: 'center' | 'right';
  wide?: boolean;
  minimal?: boolean;
  children: ReactNode;
}

export default function StationCopyWrapper({
  stationIndex,
  align,
  wide = false,
  minimal = false,
  children,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const prevTransIdx = stationIndex - 1; // transition arriving at this station
    const nextTransIdx = stationIndex;     // transition leaving this station

    return register((state: SceneState) => {
      let opacity = 0;
      const lp = state.direction === 1 ? state.progress : 1 - state.progress;

      if (state.playState === 'idle' && state.station === stationIndex) {
        opacity = 1;
      } else if (state.playState === 'playing') {
        if (state.transitionIdx === prevTransIdx) {
          // Fade IN at the end of the preceding transition — synced with s1 exit
          opacity = ss(0.85, 1.0, lp);
        } else if (state.transitionIdx === nextTransIdx) {
          // Stay opaque through the following transition, fade OUT at the end
          // (0.85→1.0). Crossfades with the next station copy fading in.
          opacity = 1 - ss(0.85, 1.0, lp);
        }
      }

      el.style.opacity       = String(opacity);
      el.style.pointerEvents = opacity > 0.75 ? 'auto' : 'none';
    });
  }, [register, stationIndex]);

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
