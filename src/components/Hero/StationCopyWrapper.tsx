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
  align?: 'center' | 'right';
  wide?: boolean;
  minimal?: boolean;
  /** Anchors the panel near the top instead of vertically centered — for
   *  stacked content tall enough to risk clipping against the sticky
   *  section's overflow:hidden when centered. */
  top?: boolean;
  /** lp point where the fade-in starts (default 0.85). Higher = snappier entry. */
  fadeInStart?: number;
  /** lp point where the fade-in completes (default 1.0). */
  fadeInEnd?: number;
  /** lp point where the fade-out starts (default 0.85). Lower = exits earlier. */
  fadeOutStart?: number;
  /** lp point where the fade-out completes (default 1.0). */
  fadeOutEnd?: number;
  /** Opacity above which the panel becomes clickable (default 0.75).
   *  Lower it for stations with a fast fade-out where visibility outlasts
   *  the default "mostly faded in" threshold (e.g. TeofiloCopy). */
  interactiveThreshold?: number;
  children: ReactNode;
}

export default function StationCopyWrapper({
  stationIndex,
  align,
  wide = false,
  minimal = false,
  top = false,
  fadeInStart = 0.85,
  fadeInEnd = 1.0,
  fadeOutStart = 0.85,
  fadeOutEnd = 1.0,
  interactiveThreshold = 0.75,
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
          opacity = ss(fadeInStart, fadeInEnd, lp);
        } else if (state.transitionIdx === nextTransIdx) {
          opacity = 1 - ss(fadeOutStart, fadeOutEnd, lp);
        }
      }

      el.style.opacity       = String(opacity);
      el.style.setProperty('--_reveal-y', `${(1 - opacity) * 14}px`);
      el.style.pointerEvents = opacity > interactiveThreshold ? 'auto' : 'none';
    });
  }, [register, stationIndex, fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd, interactiveThreshold]);

  const cls = [
    styles.copy,
    align === 'center' ? styles.centered : '',
    wide    ? styles.wide    : '',
    minimal ? styles.minimal : '',
    top     ? styles.top     : '',
  ].filter(Boolean).join(' ');

  return (
    <div ref={elRef} className={cls} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
