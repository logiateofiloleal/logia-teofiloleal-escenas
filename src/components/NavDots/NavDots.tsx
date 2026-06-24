'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useSceneSnap } from '@/context/SceneSnap';
import { STATION_IDS, STATION_NAMES } from '@/config/segments';
import styles from './NavDots.module.css';

export default function NavDots() {
  const { register, goTo } = useSceneSnap();
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const setDotRef = useCallback((el: HTMLButtonElement | null, i: number) => {
    dotRefs.current[i] = el;
  }, []);

  useEffect(() => {
    return register(state => {
      // During playing, active dot shows the TARGET station (destination)
      const active = state.playState === 'playing' ? state.target : state.station;
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
          ref={el => setDotRef(el, i)}
          className={`${styles.dot} ${i === 0 ? styles.activo : ''}`}
          title={STATION_NAMES[id]}
          aria-label={`Ir a Escena ${i + 1}: ${STATION_NAMES[id]}`}
          aria-current={i === 0 ? 'true' : 'false'}
          onClick={() => goTo(i)}
        />
      ))}
    </nav>
  );
}
