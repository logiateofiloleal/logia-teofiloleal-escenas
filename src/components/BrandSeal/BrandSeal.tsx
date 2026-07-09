'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import styles from './BrandSeal.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

// Persistent institutional seal — fixed medio-izquierda from the second
// scene onward. Hidden during El Umbral: the profano starts close to the
// left edge there, and the Header brand mark already covers institutional
// identity for that scene, so a second logo would feel redundant.
export default function BrandSeal() {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return register((state: SceneState) => {
      let opacity = 0;

      if (state.transitionIdx === 0) {
        // t1 (El Umbral) — fades in only as it completes, handing off from
        // UmbralOverlay's own logo to this persistent one.
        const lp = state.direction === 1 ? state.progress : 1 - state.progress;
        opacity = ss(0.85, 1.0, lp) * 0.9;
      } else if (state.playState === 'idle' && state.station === 0) {
        opacity = 0; // resting at El Umbral, before scrolling
      } else {
        opacity = 0.9; // s2 onward
      }

      el.style.opacity = String(opacity);
    });
  }, [register]);

  return (
    <div ref={elRef} className={styles.seal} style={{ opacity: 0 }} aria-hidden="true">
      <Image
        src="/assets/img/logo.png"
        alt=""
        width={190}
        height={190}
        className={styles.img}
        draggable={false}
      />
    </div>
  );
}
