'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useScrollEngine } from '@/context/ScrollEngine';
import styles from './UmbralOverlay.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function UmbralOverlay() {
  const elRef = useRef<HTMLDivElement>(null);
  const { register } = useScrollEngine();

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    return register(state => {
      let opacity = 0;
      let yOffset = -44; // base: matches CSS transform translateY(-44%)

      if (state.segmentId === 't1') {
        const exit = ss(0.82, 1.0, state.localProgress);
        opacity  = 1 - exit;
        yOffset  = -44 - exit * 9; // rises to -53% as it fades out
      }

      el.style.opacity       = String(opacity);
      el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';
      el.style.transform     = `translate(-50%, ${yOffset}%)`;
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
