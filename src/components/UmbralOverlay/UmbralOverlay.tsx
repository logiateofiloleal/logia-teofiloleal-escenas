'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import styles from './UmbralOverlay.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function UmbralOverlay() {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return register((state: SceneState) => {
      let opacity = 0;
      let yOffset = -44;

      if (state.playState === 'idle' && state.station === 0) {
        // Resting at El Umbral — fully visible
        opacity = 1;
        yOffset = -44;
      } else if (state.transitionIdx === 0) {
        // t1 is active (forward or reverse)
        const lp    = state.direction === 1 ? state.progress : 1 - state.progress;
        const exit  = ss(0.85, 1.0, lp); // exits at end of t1, synced with s2 entry
        opacity     = 1 - exit;
        yOffset     = -44 - exit * 9; // rises to -53% on exit
      }

      el.style.opacity       = String(opacity);
      el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
      // On mobile (≤768px), CSS positions the overlay with left:50% and top:8%;
      // JS only needs translateX(-50%) to center horizontally.
      // On desktop, keep the original vertical-center offset.
      const isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768;
      el.style.transform = isMobileView
        ? `translateX(-50%)`
        : `translate(-50%, ${yOffset}%)`;
    });
  }, [register]);

  return (
    <div ref={elRef} className={styles.overlay} style={{ opacity: 0 }}>
      <span className={styles.label}>El umbral del camino</span>
      <Image
        src="/assets/img/logo.png"
        alt="Logia Teófilo Leal N° 115"
        width={96}
        height={96}
        className={styles.logo}
        draggable={false}
        priority
      />
      <h1 className={styles.h1}>
        Sabiduría, Fuerza<br />y <em>Belleza</em>
      </h1>
      <div className={styles.sep} aria-hidden="true">
        <span className={styles.sepDot} />
      </div>
      <p className={styles.kicker}>
        Respetable Logia Simbólica · Oriente de Barquisimeto
      </p>
      <p className={styles.lema}>A∴ L∴ G∴ D∴ G∴ A∴ D∴ U∴</p>
    </div>
  );
}
