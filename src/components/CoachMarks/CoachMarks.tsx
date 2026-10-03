'use client';

import { useEffect, useState } from 'react';
import { alEstarLista } from '@/lib/landingLista';
import { FTUE, ftueVisto, marcarFtue } from '@/lib/sesionLanding';
import { ordenAudio } from '@/lib/audioEvento';
import styles from './CoachMarks.module.css';

// ── Guía de primera visita ────────────────────────────────────────────
// Con la escena ya visible (el Preloader liberó el scroll), un aviso sobrio
// abajo al centro: cómo se avanza. No bloquea nada ni captura clics: el
// primer desplazamiento real —rueda, deslizar, teclado, NavDots o menú, todos
// acaban en un scroll nativo— avanza el recorrido y, a la vez, lo desvanece.
// Solo se escucha `scroll`, pasivo: nunca se consume ni se duplica el gesto.
// Poco después, la ayuda del sonido junto a su botón (AmbientAudio).
// Cada paso se recuerda entre visitas (localStorage, sesionLanding.ts).

const SALIDA_MS = 450;          // fade-out del aviso
const PISTA_SONIDO_MS = 1200;   // tras iniciar el recorrido, la ayuda del sonido
const ARRIBA_PX = 40;           // solo si la escena está realmente al inicio

export default function CoachMarks() {
  const [fase, setFase] = useState<'oculto' | 'visible' | 'saliendo'>('oculto');

  useEffect(() => {
    const navPendiente = !ftueVisto(FTUE.navegacion);
    const sonidoPendiente = !ftueVisto(FTUE.sonido);
    if (!navPendiente && !sonidoPendiente) return;

    let raf = 0;
    let mostrado = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const alDesplazar = () => {
      if (window.scrollY < 4) return;
      window.removeEventListener('scroll', alDesplazar);
      if (mostrado) {
        marcarFtue(FTUE.navegacion);
        setFase('saliendo');
        timers.push(setTimeout(() => setFase('oculto'), SALIDA_MS));
      }
      if (sonidoPendiente) timers.push(setTimeout(() => ordenAudio('pista'), PISTA_SONIDO_MS));
    };

    const cancelar = alEstarLista(() => {
      // Tres fotogramas: deja pasar el salto de un enlace interno a S4
      // (Header, dos fotogramas tras la misma señal) y la restauración del
      // scroll al recargar. Solo se guía a quien empieza desde el inicio.
      let n = 0;
      const comprobar = () => {
        if (++n < 3) { raf = requestAnimationFrame(comprobar); return; }
        if (window.scrollY > ARRIBA_PX) return;
        if (navPendiente) { mostrado = true; setFase('visible'); }
        window.addEventListener('scroll', alDesplazar, { passive: true });
      };
      raf = requestAnimationFrame(comprobar);
    });

    return () => {
      cancelar();
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('scroll', alDesplazar);
    };
  }, []);

  // Mientras el aviso está a la vista, el ScrollHint de El Umbral se retira
  // (ocupa el mismo lugar); en visitas posteriores sigue como siempre.
  useEffect(() => {
    if (fase !== 'visible') return;
    const html = document.documentElement;
    html.setAttribute('data-guia', '');
    return () => html.removeAttribute('data-guia');
  }, [fase]);

  if (fase === 'oculto') return null;

  return (
    <div className={styles.guia} data-saliendo={fase === 'saliendo'} role="status">
      <p className={styles.titulo}>Desplázate para iniciar el recorrido</p>
      <p className={styles.texto}>Usa la rueda del mouse o desliza para avanzar.</p>

      {/* Ratón con la rueda en movimiento y chevrons (punteros finos) */}
      <div className={`${styles.gesto} ${styles.raton}`} aria-hidden="true">
        <svg viewBox="0 0 22 34" width="22" height="34">
          <rect x="1" y="1" width="20" height="32" rx="10" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <line className={styles.rueda} x1="11" y1="7" x2="11" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <svg className={styles.chevrons} viewBox="0 0 14 18" width="14" height="18">
          <polyline points="2,3 7,8 12,3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="2,10 7,15 12,10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {/* Deslizar hacia arriba (pantallas táctiles) */}
      <div className={`${styles.gesto} ${styles.deslizar}`} aria-hidden="true">
        <svg viewBox="0 0 22 40" width="22" height="40">
          <line x1="11" y1="5" x2="11" y2="35" stroke="currentColor" strokeWidth="1.2" strokeOpacity=".6" strokeLinecap="round" />
          <circle className={styles.dedo} cx="11" cy="31" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </div>
    </div>
  );
}
