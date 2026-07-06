'use client';

import { SEGMENTS, type Segment } from '@/config/segments';
import StationCopyWrapper from './StationCopyWrapper';
import ScrollHint from '@/components/ScrollHint/ScrollHint';
import CinematicOverlay from '@/components/CinematicOverlay/CinematicOverlay';
import S4Puerta from '@/components/stations/S4Puerta/S4Puerta';
import S2Principios from '@/components/stations/S2Principios/S2Principios';
import S3Memoria from '@/components/stations/S3Memoria/S3Memoria';
import styles from './Hero.module.css';

// ── Section wrapper ──────────────────────────────────────────
function HeroSection({ seg, children }: { seg: Segment; children?: React.ReactNode }) {
  return (
    <section
      className={styles.section}
      style={{ height: `${seg.scrollVh}vh` }}
      aria-label={seg.type === 'station' ? `Escena: ${seg.id}` : undefined}
    >
      <div className={styles.sticky}>
        {children}
      </div>
    </section>
  );
}

// ── Station 2: Los Principios ─────────────────────────────────
function S2Copy() {
  return (
    <StationCopyWrapper stationIndex={1} align="center" wide fadeOutStart={0.70} fadeOutEnd={0.84}>
      <S2Principios />
    </StationCopyWrapper>
  );
}

// ── Station 3: La Memoria — Homenaje a Teófilo Leal ──────────
// stationIndex=2: entra al final de t2 (fadeInStart=0.95, rápido y nítido),
// visible en s3 idle, sale con crossfade estándar durante t3.
function TeofiloCopy() {
  return (
    <StationCopyWrapper stationIndex={2} align="center" fadeInStart={0.95} fadeOutStart={0.25} fadeOutEnd={0.50}>
      <S3Memoria />
    </StationCopyWrapper>
  );
}

// ── Station 4: La Puerta — ¿Sientes el llamado? ───────────────
function S4Copy() {
  return (
    <StationCopyWrapper stationIndex={3} align="center">
      <S4Puerta />
    </StationCopyWrapper>
  );
}

const COPY: Record<string, React.ReactNode> = {
  s2: <S2Copy />,
  s3: <TeofiloCopy />,
  s4: <S4Copy />,
};

// ── Hero ──────────────────────────────────────────────────────
export default function Hero() {
  return (
    <div id="storyHero" className={styles.hero}>
      {SEGMENTS.map(seg => (
        <HeroSection key={seg.id} seg={seg}>
          {seg.type === 'station' && COPY[seg.id]}
          {/* First transition shows scroll hint and cinematic overlays */}
          {seg.id === 't1' && (
            <>
              <CinematicOverlay />
              <ScrollHint />
            </>
          )}
        </HeroSection>
      ))}
    </div>
  );
}
