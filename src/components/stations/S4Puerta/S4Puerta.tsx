'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Sep from '@/components/stations/Sep/Sep';
import { useFinalGate } from '@/context/FinalGate';
import styles from './S4Puerta.module.css';

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

export default function S4Puerta() {
  const { trigger } = useFinalGate();
  const rootRef  = useRef<HTMLDivElement>(null);
  const fraseRef = useRef<HTMLParagraphElement>(null);
  const [mounted, setMounted] = useState(false);

  // .copy's transform (StationCopyWrapper) makes it a containing block for
  // fixed descendants — a plain position:fixed <p> nested inside it would
  // stay trapped to that box, not to the viewport. Portal to <body> instead,
  // so the phrase can sit independently near the bottom of the viewport.
  useEffect(() => setMounted(true), []);

  // Reveals the closing line as the visitor nears the end of S4's own
  // scroll dwell — independent of ScrollEngine/SceneSnap, which only
  // expose idle/not-idle for station segments (no sub-progress).
  // Depends on `mounted`: fraseRef only resolves once the portal has
  // rendered the <p> into <body>, which happens one render after mount.
  useEffect(() => {
    if (!mounted) return;

    const root  = rootRef.current;
    const frase = fraseRef.current;
    if (!root || !frase) return;

    const section = root.closest('section');
    if (!section) return;

    let ticking = false;

    const update = () => {
      const rect       = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress   = scrollable > 0
        ? Math.min(1, Math.max(0, -rect.top / scrollable))
        : 0;
      frase.style.opacity = String(ss(0.68, 0.92, progress));
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [mounted]);

  return (
    <>
      <div ref={rootRef} className={styles.root}>
        <h2>¿Sientes<br />el llamado?</h2>
        <Sep />
        <p>
          La Logia Teófilo Leal N° 115 recibe a hombres que buscan
          el perfeccionamiento moral e intelectual. Si sientes que
          este es tu camino, da el primer paso.
        </p>
        <a
          href="/aspirantes"
          className={styles.btn}
          onClick={e => { e.preventDefault(); trigger(); }}
        >
          Tocar la puerta &nbsp;✦
        </a>
      </div>

      {mounted && createPortal(
        <p ref={fraseRef} className={styles.espera}>
          El umbral permanece. La decisión es tuya.
        </p>,
        document.body,
      )}
    </>
  );
}
