'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Sep from '@/components/stations/Sep/Sep';
import { useFinalGate } from '@/context/FinalGate';
import { useSceneSnap } from '@/context/SceneSnap';
import { SEGMENTS, STATION_IDS, type Station } from '@/config/segments';
import styles from './S4Puerta.module.css';

// SceneSnap station index of La Puerta, and how long the visitor must stay
// there before the closing line appears (segments.ts s4.dwellMs).
const LA_PUERTA = STATION_IDS.indexOf('s4');
const DWELL_MS =
  SEGMENTS.find((s): s is Station => s.type === 'station' && s.id === 's4')?.dwellMs ?? 1800;

export default function S4Puerta() {
  const { trigger } = useFinalGate();
  const { register } = useSceneSnap();
  const fraseRef = useRef<HTMLParagraphElement>(null);
  const [mounted, setMounted] = useState(false);

  // .copy's transform (StationCopyWrapper) makes it a containing block for
  // fixed descendants — a plain position:fixed <p> nested inside it would
  // stay trapped to that box, not to the viewport. Portal to <body> instead,
  // so the phrase can sit independently near the bottom of the viewport.
  useEffect(() => setMounted(true), []);

  // Reveals the closing line once the visitor has actually stayed at La
  // Puerta for DWELL_MS — not tied to scroll depth, so it doesn't require
  // reaching the very end of the page. Leaving the station (scrolling back
  // into t3) cancels a pending reveal and hides it; coming back restarts
  // the wait. Scrolling within s4 counts as staying.
  // Depends on `mounted`: fraseRef only resolves once the portal has
  // rendered the <p> into <body>, which happens one render after mount.
  useEffect(() => {
    if (!mounted) return;
    const frase = fraseRef.current;
    if (!frase) return;

    let atPuerta = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancel = () => {
      if (timer != null) { clearTimeout(timer); timer = null; }
    };

    const unregister = register(state => {
      const here = state.playState === 'idle' && state.station === LA_PUERTA;
      if (here === atPuerta) return;
      atPuerta = here;
      cancel();
      if (here) {
        timer = setTimeout(() => {
          timer = null;
          frase.classList.add(styles.visible);
        }, DWELL_MS);
      } else {
        frase.classList.remove(styles.visible);
      }
    });

    return () => { unregister(); cancel(); };
  }, [mounted, register]);

  return (
    <>
      <div className={styles.root}>
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
