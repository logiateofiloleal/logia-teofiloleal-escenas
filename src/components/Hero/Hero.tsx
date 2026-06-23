'use client';

import Image from 'next/image';
import { SEGMENTS, type Segment } from '@/config/segments';
import StationCopyWrapper from './StationCopyWrapper';
import ScrollHint from '@/components/ScrollHint/ScrollHint';
import CinematicOverlay from '@/components/CinematicOverlay/CinematicOverlay';
import Sep from '@/components/stations/Sep/Sep';
import S5Acceso from '@/components/stations/S5Acceso/S5Acceso';
import S4Puerta from '@/components/stations/S4Puerta/S4Puerta';
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
  const principios = [
    {
      num: 'I', titulo: 'Libertad',
      img: '/assets/img/acto2-icon-libertad-antorcha.png',
      texto: 'El pensamiento libre es la primera piedra del hombre que trabaja en sí mismo.',
    },
    {
      num: 'II', titulo: 'Igualdad',
      img: '/assets/img/acto2-icon-igualdad-balanza.png',
      texto: 'Ante la verdad, todos los hombres son iguales sin distinción de origen ni nombre.',
    },
    {
      num: 'III', titulo: 'Fraternidad',
      img: '/assets/img/acto2-icon-fraternidad-manos.png',
      texto: 'El trabajo compartido une lo que la diferencia separa y edifica lo perdurable.',
    },
  ];

  return (
    <StationCopyWrapper stationIndex={1} align="center" wide fadeOutStart={0.70} fadeOutEnd={0.84}>
      <span>Tres principios, una misma búsqueda</span>
      <h2>Libertad · Igualdad · Fraternidad</h2>
      <Sep />
      <div className={styles.principios}>
        {principios.map(p => (
          <article key={p.titulo} className={styles.principio}>
            <div className={styles.medallion} aria-hidden="true">
              <Image src={p.img} alt="" width={34} height={34} />
            </div>
            <p className={styles.num}>{p.num}</p>
            <h3 className={styles.principioTitulo}>{p.titulo}</h3>
            <p className={styles.principioTexto}>{p.texto}</p>
          </article>
        ))}
      </div>
    </StationCopyWrapper>
  );
}

// ── Station 3: La Memoria — Homenaje a Teófilo Leal ──────────
// stationIndex=2: entra al final de t2 (fadeInStart=0.95, rápido y nítido),
// visible en s3 idle, sale con crossfade estándar durante t3.
function TeofiloCopy() {
  return (
    <StationCopyWrapper stationIndex={2} align="center" fadeInStart={0.95} fadeOutStart={0.25} fadeOutEnd={0.50}>
      <p className={styles.homenajeInMemoriam}>In Memoriam</p>
      <div className={styles.homenajeMarco}>
        <Image
          src="/assets/img/acto3-cuadro-teofilo-leal-memoria.png"
          alt="Retrato de Teófilo Leal Berra"
          width={260}
          height={325}
          quality={100}
          sizes="(max-width: 768px) 200px, 260px"
          className={styles.homenajeRetrato}
          draggable={false}
        />
      </div>
      <h2 className={styles.homenajeNombre}>Teófilo Leal<br />Berra</h2>
      <div className={styles.homenajeFechas}>
        <span>1866 — 1940</span>
      </div>
      <p className={styles.homenajeRoles}>Actor · Poeta · Músico · Pintor</p>
      <p className={styles.homenajeEpitafio}>
        Su memoria ilumina cada trabajo de esta Logia.
      </p>
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

// ── Station 5: Acceso Interno ─────────────────────────────────
function S5Copy() {
  return (
    <StationCopyWrapper stationIndex={4} align="center" minimal>
      <S5Acceso />
    </StationCopyWrapper>
  );
}

const COPY: Record<string, React.ReactNode> = {
  s2: <S2Copy />,
  s3: <TeofiloCopy />,
  s4: <S4Copy />,
  s5: <S5Copy />,
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
