'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './IntroCortina.module.css';

// ── Intro: cómo se recorre la página ─────────────────────────────────
// Cortina oscura a pantalla completa, previa al preloader (la monta el
// Preloader en su fase "intro"). Sin caja ni borde: texto centrado, un
// ratón dibujado (o un gesto de deslizar en pantallas táctiles) y
// "Continuar". Desplazarse —rueda, deslizar o teclas de avance— también
// continúa, como invita el texto. No activa sonido ni atrapa el foco.

const SALIDA_MS = 450;
const TECLAS_AVANCE = new Set(['ArrowDown', 'PageDown', ' ', 'Enter']);

export default function IntroCortina({ onContinuar }: { onContinuar: () => void }) {
  const [saliendo, setSaliendo] = useState(false);
  const hechoRef = useRef(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const onContinuarRef = useRef(onContinuar);
  onContinuarRef.current = onContinuar;

  const continuar = () => {
    if (hechoRef.current) return;
    hechoRef.current = true;
    setSaliendo(true);
    setTimeout(() => onContinuarRef.current(), SALIDA_MS);
  };
  const continuarRef = useRef(continuar);
  continuarRef.current = continuar;

  useEffect(() => {
    botonRef.current?.focus({ preventScroll: true });
    let y0: number | null = null;
    const onWheel = (e: WheelEvent) => { if (e.deltaY > 4) continuarRef.current(); };
    const onTouchStart = (e: TouchEvent) => { y0 = e.touches[0]?.clientY ?? null; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y0 !== null && y !== undefined && y0 - y > 30) continuarRef.current(); // deslizar hacia arriba = avanzar
    };
    const onKey = (e: KeyboardEvent) => {
      // Enter/Espacio sobre "Continuar" ya los resuelve el propio botón.
      if (TECLAS_AVANCE.has(e.key) && e.target !== botonRef.current) { e.preventDefault(); continuarRef.current(); }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className={styles.cortina} data-saliendo={saliendo} role="region" aria-labelledby="intro-titulo">
      <div className={styles.contenido}>
        <p className={styles.titulo} id="intro-titulo">Desplázate para iniciar el recorrido</p>
        <p className={styles.texto}>Usa la rueda del mouse o desliza para avanzar.</p>

        {/* Ratón con la rueda en movimiento (punteros finos) */}
        <svg className={`${styles.icono} ${styles.raton}`} viewBox="0 0 28 44" width="28" height="44" aria-hidden="true">
          <rect x="1.25" y="1.25" width="25.5" height="41.5" rx="12.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line className={styles.rueda} x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Gesto de deslizar hacia arriba (pantallas táctiles) */}
        <svg className={`${styles.icono} ${styles.deslizar}`} viewBox="0 0 28 48" width="28" height="48" aria-hidden="true">
          <line x1="14" y1="6" x2="14" y2="42" stroke="currentColor" strokeWidth="1" strokeOpacity=".35" strokeLinecap="round" />
          <circle className={styles.dedo} cx="14" cy="38" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>

        <button ref={botonRef} type="button" className={styles.continuar} onClick={continuar}>
          Continuar
        </button>
      </div>
    </div>
  );
}
