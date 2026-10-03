'use client';

import { useEffect, useState } from 'react';
import { alEstarLista } from '@/lib/landingLista';
import { FTUE, ftueVisto } from '@/lib/sesionLanding';
import { ordenAudio } from '@/lib/audioEvento';
import styles from './CoachMarks.module.css';

// ── Guía de navegación ────────────────────────────────────────────────
// En cada entrada por el preloader (no al volver a / dentro de la sesión,
// ni con un enlace interno a S4, ni con el scroll restaurado), con la
// escena ya visible: un velo oscuro translúcido sobre la escena y, en el
// hueco libre de la composición, cómo se avanza. No es un modal: no
// bloquea ni captura clics. El primer desplazamiento real —rueda, deslizar,
// teclado, NavDots o menú, todos acaban en un scroll nativo— avanza el
// recorrido y, a la vez, desvanece guía y velo. Solo se escucha `scroll`,
// pasivo: nunca se consume ni se duplica el gesto. Después, la primera
// ayuda del sonido junto a su botón (AmbientAudio, recordada entre visitas).

const SALIDA_MS = 450;          // fade-out de guía y velo (= CSS)
const PISTA_SONIDO_MS = 1200;   // tras iniciar el recorrido, la ayuda del sonido
const ARRIBA_PX = 40;           // solo si la escena está realmente al inicio

type Lugar = { compacto: boolean; x: number; y: number; ancho: number };

/** Caja del texto de El Umbral (solo lectura; null si no está). */
function textoUmbral(): DOMRect | null {
  const o = document.querySelector('[class*="UmbralOverlay-module"][class*="__overlay"]');
  if (!o) return null;
  const rs = [...o.querySelectorAll('*')]
    .filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
    .map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
  if (!rs.length) return null;
  const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
  return new DOMRect(l, t, Math.max(...rs.map(r => r.right)) - l, Math.max(...rs.map(r => r.bottom)) - t);
}

// Hueco libre de la composición de El Umbral, con la misma proyección del
// encuadre (cover) que usan S2/S4: el profano está a la izquierda en 16:9
// (hasta x ≈ 0.27) y en la parte baja en 9:16 (desde y ≈ 0.74).
function calcularLugar(): Lugar {
  const vw = window.innerWidth, vh = window.innerHeight;
  const s1 = textoUmbral();
  const compacto = { compacto: true, x: 0, y: 0, ancho: 0 };
  if (vh <= 500 && vw / vh >= 1.5) return compacto;   // teléfono horizontal: sin hueco central
  if (vh >= vw) {
    const fh = Math.max(vh, vw * 16 / 9), fy = (vh - fh) / 2;
    const arriba = s1 ? s1.bottom : vh * 0.4;
    const figura = fy + fh * 0.74;
    return { compacto: false, x: vw / 2, y: (arriba + figura) / 2, ancho: vw - 40 };
  }
  const fw = Math.max(vw, vh * 16 / 9), fx = (vw - fw) / 2;
  const izq = fx + fw * 0.27 + 24;
  const der = (s1 ? s1.left : vw * 0.62) - 24;
  if (der - izq < 240) return compacto;
  return { compacto: false, x: (izq + der) / 2, y: vh / 2, ancho: Math.min(der - izq, 560) };
}

export default function CoachMarks() {
  const [fase, setFase] = useState<'oculto' | 'visible' | 'saliendo'>('oculto');
  const [lugar, setLugar] = useState<Lugar | null>(null);

  useEffect(() => {
    let raf = 0;
    let mostrado = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const recolocar = () => setLugar(calcularLugar());

    const alDesplazar = () => {
      if (window.scrollY < 4) return;
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', recolocar);
      if (mostrado) {
        setFase('saliendo');
        timers.push(setTimeout(() => setFase('oculto'), SALIDA_MS));
      }
      if (!ftueVisto(FTUE.sonido)) timers.push(setTimeout(() => ordenAudio('pista'), PISTA_SONIDO_MS));
    };

    const cancelar = alEstarLista(porPreloader => {
      if (!porPreloader) return;   // solo en la entrada normal por el preloader
      // Tres fotogramas: deja pasar el salto de un enlace interno a S4
      // (Header, dos fotogramas tras la misma señal) y la restauración del
      // scroll al recargar. Solo se guía a quien empieza desde el inicio.
      let n = 0;
      const comprobar = () => {
        if (++n < 3) { raf = requestAnimationFrame(comprobar); return; }
        if (window.scrollY > ARRIBA_PX) return;
        mostrado = true;
        recolocar();
        setFase('visible');
        window.addEventListener('scroll', alDesplazar, { passive: true });
        window.addEventListener('resize', recolocar);
      };
      raf = requestAnimationFrame(comprobar);
    });

    return () => {
      cancelar();
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', recolocar);
    };
  }, []);

  // Mientras la guía está a la vista, el ScrollHint de El Umbral se retira
  // (sería una instrucción duplicada); después vuelve a lo suyo.
  useEffect(() => {
    if (fase !== 'visible') return;
    const html = document.documentElement;
    html.setAttribute('data-guia', '');
    return () => html.removeAttribute('data-guia');
  }, [fase]);

  if (fase === 'oculto' || !lugar) return null;
  const saliendo = fase === 'saliendo';
  const pos = lugar.compacto ? undefined : { left: lugar.x, top: lugar.y, maxWidth: lugar.ancho };
  const foco = lugar.compacto ? undefined : ({ '--gx': `${lugar.x}px`, '--gy': `${lugar.y}px` } as React.CSSProperties);

  return (
    <>
      {/* Velo: la escena sigue a la vista, apenas más oscura; sin clics. */}
      <div className={styles.velo} data-saliendo={saliendo} style={foco} aria-hidden="true" />
      <div className={styles.guia} data-compacto={lugar.compacto} data-saliendo={saliendo} style={pos} role="status">
        <p className={styles.titulo}>Desplázate para iniciar el recorrido</p>
        <span className={styles.filete} aria-hidden="true" />
        <p className={styles.texto}>Usa la rueda del mouse o desliza para avanzar.</p>

        {/* Ratón con la rueda en movimiento y chevrons (punteros finos) */}
        <div className={`${styles.gesto} ${styles.raton}`} aria-hidden="true">
          <svg viewBox="0 0 28 44" width="28" height="44">
            <rect x="1.25" y="1.25" width="25.5" height="41.5" rx="12.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line className={styles.rueda} x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg className={styles.chevrons} viewBox="0 0 16 22" width="16" height="22">
            <polyline points="2,4 8,10 14,4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="2,12 8,18 14,12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* Deslizar hacia arriba (pantallas táctiles) */}
        <div className={`${styles.gesto} ${styles.deslizar}`} aria-hidden="true">
          <svg viewBox="0 0 28 52" width="28" height="52">
            <line x1="14" y1="6" x2="14" y2="46" stroke="currentColor" strokeWidth="1.3" strokeOpacity=".6" strokeLinecap="round" />
            <circle className={styles.dedo} cx="14" cy="41" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </>
  );
}
