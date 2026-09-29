'use client';

import { SEGMENTS, type Segment } from '@/config/segments';
import StationCopyWrapper from './StationCopyWrapper';
import ScrollHint from '@/components/ScrollHint/ScrollHint';
import S4Puerta from '@/components/stations/S4Puerta/S4Puerta';
import S2Principios from '@/components/stations/S2Principios/S2Principios';
import S3Memoria, { S3Veil } from '@/components/stations/S3Memoria/S3Memoria';
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
// Medio-derecha, apilado y angosto — el profano camina por el eje central
// del pasillo durante t1/t2, así que el bloque ancho/centrado anterior
// terminaba tapándolo. La columna derecha permanece libre en toda la escena.
// Entra al 88–100 % de t1, después de que El Umbral terminó de salir
// (72–86 %, UmbralOverlay.tsx): nunca hay dos textos a la vez.
function S2Copy() {
  return (
    <StationCopyWrapper stationIndex={1} top fadeInStart={0.88} fadeOutStart={0.70} fadeOutEnd={0.84}>
      <S2Principios />
    </StationCopyWrapper>
  );
}

// ── Station 3: La Memoria — Homenaje a Teófilo Leal ──────────
// stationIndex=2: entra al 90–100 % de t2, tras la pausa sin texto que deja
// la salida de s2 (84 %); antes entraba de golpe en el último 5 %.
// visible en s3 idle, sale con crossfade estándar durante t3.
// Dentro de s3 el retrato viaja desde su lugar a la derecha hasta el centro
// y el fondo se desenfoca (S3Memoria.tsx); S3Veil es la capa de desenfoque,
// hermana del panel para que su posición fija no quede atrapada en él.
function TeofiloCopy() {
  return (
    <>
      <S3Veil />
      <StationCopyWrapper
        stationIndex={2}
        fadeInStart={0.90}
        fadeOutStart={0.25}
        fadeOutEnd={0.50}
        interactiveThreshold={0}
        className={styles.memoria}
      >
        <S3Memoria />
      </StationCopyWrapper>
    </>
  );
}

// ── Station 4: La Puerta — ¿Sientes el llamado? ───────────────
// Medio-derecha — el profano queda de pie, centrado y en primer plano
// justo frente a la puerta; el texto/CTA centrados antes caían sobre él.
// En tablets horizontales (4:3–3:2) el cover recorta los lados y la cabeza y
// la mano quedan más a la derecha: .puerta sube el bloque a la esquina
// superior derecha, por encima de la mano (Hero.module.css).
function S4Copy() {
  return (
    <StationCopyWrapper stationIndex={3} className={styles.puerta}>
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
          {/* First transition shows the scroll hint */}
          {seg.id === 't1' && <ScrollHint />}
        </HeroSection>
      ))}
    </div>
  );
}
