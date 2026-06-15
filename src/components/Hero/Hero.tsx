'use client';

import Image from 'next/image';
import { SEGMENTS, type Segment } from '@/config/segments';
import StationCopyWrapper from './StationCopyWrapper';
import TransitionCopyWrapper from './TransitionCopyWrapper';
import ScrollHint from '@/components/ScrollHint/ScrollHint';
import CinematicOverlay from '@/components/CinematicOverlay/CinematicOverlay';
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

// ── Separator ─────────────────────────────────────────────────
function Sep() {
  return (
    <div className={styles.sep} aria-hidden="true">
      <span className={styles.sepDot} />
    </div>
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
    <StationCopyWrapper stationIndex={1} align="center" wide>
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

// ── Station 3: La Memoria ─────────────────────────────────────
function S3Copy() {
  return (
    <StationCopyWrapper stationIndex={2} align="right">
      <span>La memoria que ilumina el presente</span>
      {/* Floating portrait — visible while station is at rest */}
      <a
        href="/teofilo-leal"
        className={styles.retrato}
        aria-label="Conocer la biografía de Teófilo Leal"
      >
        <Image
          src="/assets/img/acto3-cuadro-teofilo-leal-memoria.png"
          alt="Retrato de Teófilo Leal Berra"
          width={180} height={225}
          draggable={false}
        />
        <span className={styles.retratoLegado}>Conocer su legado</span>
      </a>
      <p className={styles.overline}>In Memoriam</p>
      <h2 className={styles.nombre}>Teófilo Leal<br />Berra</h2>
      <p className={styles.fechas}>1866 — 1940</p>
      <Sep />
      <blockquote className={styles.cita}>
        Actor, poeta, músico y pintor. Ejemplo luminoso de que la Masonería
        no separa al hombre de la cultura, sino que lo eleva por ella.
        Su memoria vive en cada trabajo de esta institución.
      </blockquote>
    </StationCopyWrapper>
  );
}

// ── Transition 3: La Puerta (overlay during animation) ────────
// Identical content to S4Copy so the handoff at the end of t3 is seamless.
function T3Copy() {
  return (
    <TransitionCopyWrapper transitionIdx={2}>
      <svg
        className={styles.arco}
        viewBox="0 0 100 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12,128 L12,52 Q12,12 50,12 Q88,12 88,52 L88,128"
              stroke="#9a7432" strokeWidth="1.5" fill="none"/>
        <path d="M22,128 L22,56 Q22,23 50,23 Q78,23 78,56 L78,128"
              stroke="#9a7432" strokeWidth="0.7" fill="none" opacity="0.4"/>
        <circle cx="50" cy="12" r="5"   stroke="#9a7432" strokeWidth="1.2" fill="none"/>
        <circle cx="50" cy="12" r="2.2" fill="#c9a84c"/>
        <line x1="50" y1="24" x2="50" y2="128"
              stroke="#9a7432" strokeWidth="0.5" opacity="0.26"/>
        <line x1="10" y1="127" x2="90" y2="127"
              stroke="#9a7432" strokeWidth="1" opacity="0.5"/>
      </svg>

      <h2>¿Sientes<br />el llamado?</h2>
      <Sep />
      <p>
        La Logia Teófilo Leal N° 115 recibe a hombres que buscan
        el perfeccionamiento moral e intelectual. Si sientes que
        este es tu camino, da el primer paso.
      </p>
      <a href="/aspirantes" className={`${styles.btn} ${styles.btnPrimary}`}>
        Tocar la puerta &nbsp;✦
      </a>
    </TransitionCopyWrapper>
  );
}

// ── Station 4: La Puerta ──────────────────────────────────────
function S4Copy() {
  return (
    <StationCopyWrapper stationIndex={3} align="center">
      {/* Masonic arch SVG — inline, gold stroke, no fill */}
      <svg
        className={styles.arco}
        viewBox="0 0 100 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12,128 L12,52 Q12,12 50,12 Q88,12 88,52 L88,128"
              stroke="#9a7432" strokeWidth="1.5" fill="none"/>
        <path d="M22,128 L22,56 Q22,23 50,23 Q78,23 78,56 L78,128"
              stroke="#9a7432" strokeWidth="0.7" fill="none" opacity="0.4"/>
        <circle cx="50" cy="12" r="5"   stroke="#9a7432" strokeWidth="1.2" fill="none"/>
        <circle cx="50" cy="12" r="2.2" fill="#c9a84c"/>
        <line x1="50" y1="24" x2="50" y2="128"
              stroke="#9a7432" strokeWidth="0.5" opacity="0.26"/>
        <line x1="10" y1="127" x2="90" y2="127"
              stroke="#9a7432" strokeWidth="1" opacity="0.5"/>
      </svg>

      <h2>¿Sientes<br />el llamado?</h2>
      <Sep />
      <p>
        La Logia Teófilo Leal N° 115 recibe a hombres que buscan
        el perfeccionamiento moral e intelectual. Si sientes que
        este es tu camino, da el primer paso.
      </p>
      <a href="/aspirantes" className={`${styles.btn} ${styles.btnPrimary}`}>
        Tocar la puerta &nbsp;✦
      </a>
    </StationCopyWrapper>
  );
}

// ── Station 5: Acceso Interno ─────────────────────────────────
function S5Copy() {
  return (
    <StationCopyWrapper stationIndex={4} align="center" minimal>
      <p className={styles.emblema}>✦</p>
      <Sep />
      <h2>Acceso<br />Administrativo</h2>
      <p className={styles.subtitulo}>Exclusivo para miembros de la Logia</p>
      <a href="/login" className={`${styles.btn} ${styles.btnDiscreto}`}>
        Ingresar →
      </a>
    </StationCopyWrapper>
  );
}

const COPY: Record<string, React.ReactNode> = {
  s2: <S2Copy />,
  s3: <S3Copy />,
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
          {/* Escena 3: overlay copy during t3 animation */}
          {seg.id === 't3' && <T3Copy />}
        </HeroSection>
      ))}
    </div>
  );
}
