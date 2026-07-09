'use client';

import { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { getPreloadProgress, waitForPreloadReady } from '@/lib/preloadGate';
import styles from './Preloader.module.css';

const PRE = {
  minSkipMs:  2200,
  pausaF1:    550,
  durFade:    750,
  durF2:      2400,
  durPanel:   820,
  pausaPanel: 60,
  durRetiro:  980,
};

const SESSION_KEY = 'logiaPreloaderVisto';

function yaVisto(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === 'true'; }
  catch { return false; }
}

function marcarVisto(): void {
  try { sessionStorage.setItem(SESSION_KEY, 'true'); }
  catch {}
}

export default function Preloader() {
  const preRef    = useRef<HTMLDivElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const barraRef  = useRef<HTMLDivElement>(null);
  const barraTrackRef = useRef<HTMLDivElement>(null);
  const identidadRef  = useRef<HTMLDivElement>(null);

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const skip = useCallback(() => {
    if (preRef.current)   preRef.current.classList.add(styles.oculto);
    if (panelRef.current) panelRef.current.classList.add(styles.oculto);
    document.body.style.overflow = '';
  }, []);

  const cubrirConPanel = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.classList.add(styles.cubriendo);
    setTimeout(() => {
      marcarVisto();
      if (preRef.current) preRef.current.classList.add(styles.oculto);
      document.body.style.overflow = '';
      setTimeout(() => {
        if (!panel.isConnected) return;
        panel.classList.remove(styles.cubriendo);
        panel.classList.add(styles.retirando);
        setTimeout(() => panel.classList.add(styles.oculto), PRE.durRetiro + 100);
      }, PRE.pausaPanel);
    }, PRE.durPanel);
  }, []);

  useEffect(() => {
    if (reducedMotion || yaVisto()) { skip(); return; }

    document.body.style.overflow = 'hidden';

    let puedeSkip  = false;
    let saltado    = false;
    let panelActivo = false;

    const intentarSaltar = () => {
      if (puedeSkip && !saltado) {
        saltado = true;
        clearInterval(timer);
        limpiarSkip();
        // Skip only fast-forwards the decorative choreography — the loader
        // still can't disappear before the real assets are ready.
        waitForPreloadReady().then(() => {
          const b = barraRef.current;
          if (b) { b.style.transition = 'width 0.25s ease-out'; b.style.width = '100%'; }
          setTimeout(() => { if (!panelActivo) { panelActivo = true; cubrirConPanel(); } }, 340);
        });
      }
    };

    const limpiarSkip = () => {
      document.removeEventListener('click',      intentarSaltar);
      document.removeEventListener('keydown',    intentarSaltar);
      document.removeEventListener('touchstart', intentarSaltar);
    };

    setTimeout(() => { puedeSkip = true; }, PRE.minSkipMs);
    document.addEventListener('click',      intentarSaltar);
    document.addEventListener('keydown',    intentarSaltar);
    document.addEventListener('touchstart', intentarSaltar, { passive: true });

    // Bar width tracks real asset-loading progress — no fixed duration.
    // It only reaches 100% once the required images/frames are actually loaded.
    const timer = setInterval(() => {
      if (saltado) { clearInterval(timer); return; }
      const progBarra = getPreloadProgress() * 100;
      if (barraRef.current) barraRef.current.style.width = progBarra + '%';
      if (progBarra >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          if (saltado) return;
          if (barraTrackRef.current) barraTrackRef.current.classList.add(styles.oculta);
          setTimeout(() => {
            if (saltado) return;
            if (identidadRef.current) identidadRef.current.classList.add(styles.visible);
            setTimeout(() => {
              if (!panelActivo) { panelActivo = true; limpiarSkip(); cubrirConPanel(); }
            }, PRE.durF2);
          }, Math.round(PRE.durFade * 0.55));
        }, PRE.pausaF1);
      }
    }, 16);

    return () => { clearInterval(timer); limpiarSkip(); };
  }, [skip, cubrirConPanel, reducedMotion]);

  return (
    <>
      <div ref={preRef} className={styles.preloader} aria-hidden="true">
        <div className={styles.contenido}>
          <div className={styles.logoWrap}>
            <Image
              src="/assets/img/logo.png"
              alt=""
              width={220}
              height={220}
              className={styles.logoImg}
              priority
              draggable={false}
            />
          </div>
          <div className={styles.info}>
            <div ref={barraTrackRef} className={styles.barraTrack}>
              <div ref={barraRef} className={styles.barra} />
            </div>
            <div ref={identidadRef} className={styles.identidad}>
              <span className={styles.idNombre}>Logia Teófilo Leal N° 115</span>
              <span className={styles.idOriente}>Oriente de Barquisimeto</span>
            </div>
          </div>
        </div>
      </div>
      <div ref={panelRef} className={styles.panel} aria-hidden="true" />
    </>
  );
}
