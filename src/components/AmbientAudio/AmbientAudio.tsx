'use client';

import { useEffect, useRef, useState } from 'react';
import { waitForPreloadReady } from '@/lib/preloadGate';
import styles from './AmbientAudio.module.css';

const SRC = '/assets/audio/ambient-loop.mp3';
const VOLUME = 0.45;

// Background music for the landing experience. Muted autoplay is allowed by
// every browser, so the loop starts silently once the real preload gate
// resolves; a visible toggle is the only way to unmute (audible playback
// requires a trusted click, which the toggle itself provides).
export default function AmbientAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const audio = new Audio(SRC);
    audio.loop = true;
    audio.volume = VOLUME;
    audio.muted = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    let cancelled = false;
    waitForPreloadReady().then(() => {
      if (cancelled) return;
      audio.play().catch(() => {});
    });

    return () => {
      cancelled = true;
      audioRef.current = null;
      audio.pause();
      audio.src = '';
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
  };

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-pressed={!muted}
      aria-label={muted ? 'Activar música ambiental' : 'Silenciar música ambiental'}
      data-muted={muted}
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
  );
}
