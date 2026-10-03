'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { waitForPreloadReady } from '@/lib/preloadGate';
import { AUDIO_EVENTO, type AudioOrden } from '@/lib/audioEvento';
import { SESION, FTUE, guardarSesion, leerSesion, ftueVisto, marcarFtue } from '@/lib/sesionLanding';
import styles from './AmbientAudio.module.css';

const SRC = '/assets/audio/ambient-loop.mp3';
const VOLUME = 0.45;
const FADE_MS = 500;

const PISTA_MS = 6500;                 // la ayuda se va sola (= pista-vida en el CSS)

const leerSonido = () => leerSesion(SESION.sonido);
const guardarSonido = (v: 'on' | 'off') => guardarSesion(SESION.sonido, v);

function fundir(audio: HTMLAudioElement, hasta: number, ms: number): Promise<void> {
  const desde = audio.volume;
  if (ms <= 0 || desde === hasta) { audio.volume = hasta; return Promise.resolve(); }
  const t0 = performance.now();
  return new Promise(resolve => {
    const paso = () => {
      const k = Math.min((performance.now() - t0) / ms, 1);
      audio.volume = desde + (hasta - desde) * k;
      if (k < 1) setTimeout(paso, 16); else resolve();
    };
    paso();
  });
}

// Música de la experiencia narrativa (solo la landing: HeroPage la monta).
//
// Autoplay: el loop arranca SILENCIADO al liberarse el preloader, algo que
// todos los navegadores permiten. Solo un gesto del visitante sobre el
// botón lo hace audible; nunca se llama a play() con sonido sin
// interacción válida. Si el navegador aun así lo rechaza, sigue en
// silencio y el botón queda listo para reintentar.
//
// Pista: en la primera visita, poco después de que el visitante inicia el
// recorrido (la pide CoachMarks por el canal de audioEvento), si el sonido
// sigue apagado, un texto breve y una flecha discreta señalan el botón unos
// segundos. No bloquea clics ni es obligatoria; se muestra una sola vez.
//
// Un solo reproductor y un solo botón. Al salir de la landing, fade-out y
// pausa; el modal de acceso lo suspende mientras está abierto.
export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [pista, setPista] = useState(false);
  const suspendidoRef = useRef<{ audible: boolean } | null>(null);

  /** Intenta sonar (dentro de un gesto del usuario); false si el navegador lo rechaza. */
  const activar = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    audio.muted = false;
    audio.volume = VOLUME;
    try {
      await audio.play();
      setMuted(false);
      guardarSonido('on');
      return true;
    } catch {
      audio.muted = true;
      setMuted(true);
      return false;
    }
  }, []);

  const activarRef = useRef(activar);
  activarRef.current = activar;

  const silenciar = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = true;
    setMuted(true);
    guardarSonido('off');
  }, []);

  useEffect(() => {
    const audio = new Audio(SRC);
    audio.loop = true;
    audio.volume = VOLUME;
    audio.muted = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    let cancelled = false;
    // Gesto que devuelve el sonido elegido en la sesión (ver abajo).
    const GESTOS = ['pointerdown', 'keydown', 'touchend'] as const;
    const alPrimerGesto = (e: Event) => {
      GESTOS.forEach(g => window.removeEventListener(g, alPrimerGesto, true));
      // Sobre el propio botón de sonido decide el botón (si no, el gesto lo
      // activaría y el clic lo volvería a silenciar).
      if ((e.target as Element | null)?.closest?.('[data-audio-toggle]')) return;
      if (!cancelled && audio.muted) activarRef.current();
    };

    waitForPreloadReady().then(() => {
      if (cancelled) return;
      audio.play().catch(() => {}); // loop silenciado: permitido sin gesto
      if (leerSonido() !== 'on') return;
      // Volver a la landing con el sonido elegido. Nunca se intenta sonar
      // sin una interacción válida en este documento: si ya la hay
      // (navegación interna), suena; si no (recarga), sigue en silencio y
      // el primer clic, toque o tecla del visitante lo devuelve.
      if (navigator.userActivation?.hasBeenActive) activarRef.current();
      else GESTOS.forEach(g => window.addEventListener(g, alPrimerGesto, true));
    });

    const onOrden = (e: Event) => {
      const orden = (e as CustomEvent<AudioOrden>).detail;
      if (orden === 'suspender' && !suspendidoRef.current) {
        suspendidoRef.current = { audible: !audio.muted && !audio.paused };
        if (suspendidoRef.current.audible) fundir(audio, 0, FADE_MS).then(() => { if (suspendidoRef.current) audio.pause(); });
      } else if (orden === 'pista') {
        if (ftueVisto(FTUE.sonido)) return;
        marcarFtue(FTUE.sonido);
        if (audio.muted) setPista(true);
      } else if (orden === 'reanudar' && suspendidoRef.current) {
        const { audible } = suspendidoRef.current;
        suspendidoRef.current = null;
        if (audible) audio.play().then(() => fundir(audio, VOLUME, FADE_MS)).catch(() => { audio.muted = true; setMuted(true); });
      }
    };
    window.addEventListener(AUDIO_EVENTO, onOrden);

    return () => {
      cancelled = true;
      audioRef.current = null;
      window.removeEventListener(AUDIO_EVENTO, onOrden);
      GESTOS.forEach(g => window.removeEventListener(g, alPrimerGesto, true));
      // Salida de la landing: fade-out breve y pausa; nada queda sonando
      // detrás de /aspirantes, /interno o /panel.
      const cortar = () => { audio.pause(); audio.removeAttribute('src'); audio.load(); };
      if (!audio.muted && !audio.paused) fundir(audio, 0, FADE_MS).then(cortar);
      else cortar();
    };
  }, []);

  useEffect(() => {
    if (!pista) return;
    const t = setTimeout(() => setPista(false), PISTA_MS);
    return () => clearTimeout(t);
  }, [pista]);

  useEffect(() => { if (!muted) setPista(false); }, [muted]);

  const toggle = () => {
    setPista(false);
    if (muted) activar();
    else silenciar();
  };

  return (
    <>
      {pista && (
        <div className={styles.pista} role="status">
          <span className={styles.pistaTexto}>Activa el sonido para una experiencia completa.</span>
          <svg className={styles.pistaFlecha} viewBox="0 0 56 16" width="56" height="16" aria-hidden="true">
            <line x1="2" y1="8" x2="50" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <polyline points="43,2.5 51,8 43,13.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <button
        type="button"
        className={styles.toggle}
        onClick={toggle}
        aria-pressed={!muted}
        aria-label={muted ? 'Activar música ambiental' : 'Silenciar música ambiental'}
        data-muted={muted}
        data-audio-toggle
      >
        {muted ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="4,9 4,15 8,15 13,20 13,4 8,9" fill="currentColor" stroke="none" />
            <line x1="16" y1="9" x2="21" y2="15" />
            <line x1="21" y1="9" x2="16" y2="15" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="4,9 4,15 8,15 13,20 13,4 8,9" fill="currentColor" stroke="none" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </svg>
        )}
      </button>
    </>
  );
}
