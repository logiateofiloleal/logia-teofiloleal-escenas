'use client';

import { useEffect, useRef } from 'react';
import { useScrollEngine } from '@/context/ScrollEngine';
import { STATION_IDS, STATION_NAMES, SEGMENTS } from '@/config/segments';
import styles from './NavDots.module.css';

function scrollToStation(idx: number) {
  const vh = window.innerHeight;
  let cumVh = 0;
  let stIdx = 0;
  for (const seg of SEGMENTS) {
    if (seg.type === 'station') {
      if (stIdx === idx) {
        // Scroll to 15% into the station
        const targetVh = cumVh + seg.scrollVh * 0.15;
        window.scrollTo({
          top: targetVh * vh / 100,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
        return;
      }
      stIdx++;
    }
    cumVh += seg.scrollVh;
  }
}

export default function NavDots() {
  const { register } = useScrollEngine();
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    return register(state => {
      const active = state.stationIndex;
      dotRefs.current.forEach((dot, i) => {
        if (!dot) return;
        const isActive = i === active;
        dot.classList.toggle(styles.activo, isActive);
        dot.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    });
  }, [register]);

  return (
    <nav id="escenas-nav" className={styles.nav} aria-label="Navegación por escenas">
      {STATION_IDS.map((id, i) => (
        <button
          key={id}
          ref={el => { dotRefs.current[i] = el; }}
          className={`${styles.dot} ${i === 0 ? styles.activo : ''}`}
          title={STATION_NAMES[id]}
          aria-label={`Ir a Escena ${i + 1}: ${STATION_NAMES[id]}`}
          aria-current={i === 0 ? 'true' : 'false'}
          onClick={() => scrollToStation(i)}
        />
      ))}
    </nav>
  );
}
