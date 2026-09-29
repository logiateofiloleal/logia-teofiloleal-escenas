'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSceneSnap } from '@/context/SceneSnap';
import styles from './S3Memoria.module.css';

// ── La Memoria: the portrait travels to the centre within s3 ──────────
// As the visitor scrolls through s3's own 80vh, the portrait leaves its
// resting place at the right, travels to the centre, grows and loses its
// -14° turn, while the tribute text appears around it and the scene
// behind goes out of focus (depth of field, not darkening).
//
// Layout is FLIP: the panel always carries the final centred layout
// (data-s3="final", styled in Hero/S3Memoria CSS); before the end of the
// travel an inverse transform (translate + scale + rotateY) puts the
// portrait back where it rests today. Only transform/opacity animate.
//
// Station progress p (0 → 1 over s3's 80vh) is read from the section's own
// position, so SceneSnap/ScrollEngine stay untouched; the block's entry
// (end of t2) and exit (t3 25–50%) remain StationCopyWrapper's job.

const TRAVEL: [number, number] = [0.02, 0.40];          // portrait travel, eased
const TEXTS: [string, number, number][] = [              // staggered text reveal
  ['inMemoriam', 0.14, 0.26],
  ['nombre',     0.18, 0.30],
  ['fechas',     0.22, 0.34],
  ['roles',      0.26, 0.38],
  ['epitafio',   0.30, 0.42],
];
const LOCAL_VEIL: [number, number] = [0.18, 0.42];      // radial behind the text block
const RESTING_TURN_DEG = -14;                            // .marco's desktop tilt
// Eases the displayed progress toward the scroll position (same idea as the
// canvas frame lerp) so a mouse-wheel step animates instead of jumping.
const LERP = 0.2;
const LERP_EPSILON = 0.0005;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const ss = (a: number, b: number, v: number) => { const x = clamp01((v - a) / (b - a)); return x * x * (3 - 2 * x); };
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

interface Geometry { dx: number; dy: number; scale: number; ox: number; oy: number; turn: number }

/** Depth-of-field layer behind the tribute: blurs the scene, never darkens
 *  it (see .veil). Rendered as a sibling of the station panel — inside the
 *  panel its transform would trap a fixed layer. */
export function S3Veil() {
  return <div className={styles.veil} data-s3-veil aria-hidden="true" />;
}

export default function S3Memoria() {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const { register } = useSceneSnap();

  useEffect(() => {
    const root = rootRef.current;
    const panel = root?.parentElement;
    const section = root?.closest('section');
    const veil = section?.querySelector<HTMLElement>('[data-s3-veil]');
    const marco = root?.querySelector<HTMLElement>(`.${styles.marco}`);
    if (!root || !panel || !section || !veil || !marco) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const texts = TEXTS.map(([cls, a, b]) => [root.querySelector<HTMLElement>(`.${styles[cls]}`), a, b] as const);
    let geom: Geometry | null = null;
    let raf = 0;
    let shown = -1; // displayed station progress (-1 = snap to target on next frame)

    const setVars = (dx: number, dy: number, scale: number, turn: number) => {
      panel.style.setProperty('--s3-dx', `${dx.toFixed(2)}px`);
      panel.style.setProperty('--s3-dy', `${dy.toFixed(2)}px`);
      panel.style.setProperty('--s3-scale', scale.toFixed(4));
      panel.style.setProperty('--s3-turn', `${turn.toFixed(2)}deg`);
    };

    // Resting rect (today's layout, turn removed) vs final centred rect.
    // The wrapper's reveal offset is zeroed while measuring: the resting
    // layout on phones has no transform, so it would otherwise skew dy.
    const measure = () => {
      const reveal = panel.style.getPropertyValue('--_reveal-y');
      panel.style.setProperty('--_reveal-y', '0px');
      panel.removeAttribute('data-s3');
      setVars(0, 0, 1, 0);
      marco.style.transform = 'none';
      const a = marco.getBoundingClientRect();
      marco.style.transform = '';
      panel.setAttribute('data-s3', 'final');
      const b = marco.getBoundingClientRect();
      const r = root.getBoundingClientRect();
      panel.style.setProperty('--_reveal-y', reveal || '0px');
      const turn = window.matchMedia('(max-width: 768px)').matches ? 0 : RESTING_TURN_DEG;
      geom = {
        dx: a.left + a.width / 2 - (b.left + b.width / 2),
        dy: a.top + a.height / 2 - (b.top + b.height / 2),
        scale: a.height / b.height,
        ox: b.left + b.width / 2 - r.left,
        oy: b.top + b.height / 2 - r.top,
        turn,
      };
      panel.style.setProperty('--s3-ox', `${geom.ox.toFixed(1)}px`);
      panel.style.setProperty('--s3-oy', `${geom.oy.toFixed(1)}px`);
    };

    const apply = () => {
      raf = 0;
      if (!geom) return;
      const s = section.getBoundingClientRect();
      const target = reduced ? 1 : clamp01(-s.top / s.height);
      shown = shown < 0 || reduced ? target : shown + (target - shown) * LERP;
      if (Math.abs(target - shown) < LERP_EPSILON) shown = target;
      const p = shown;
      const e = reduced ? 1 : easeInOutCubic(clamp01((p - TRAVEL[0]) / (TRAVEL[1] - TRAVEL[0])));
      const k = 1 - e;
      setVars(geom.dx * k, geom.dy * k, 1 + (geom.scale - 1) * k, geom.turn * k);
      for (const [el, a, b] of texts) if (el) el.style.opacity = String(reduced ? 1 : ss(a, b, p));
      panel.style.setProperty('--s3-local', String(reduced ? 1 : ss(LOCAL_VEIL[0], LOCAL_VEIL[1], p)));
      // Depth of field follows the travel and fades with the block itself
      // (StationCopyWrapper drives the panel's opacity on entry/exit).
      const op = e * (parseFloat(panel.style.opacity) || 0);
      veil.style.opacity = op.toFixed(3);
      veil.style.visibility = op > 0.001 ? 'visible' : 'hidden';
      if (shown !== target) schedule(); // keep easing toward the scroll position
    };
    // Runs after all SceneSnap callbacks of this frame, so the panel's
    // opacity set by StationCopyWrapper is already current.
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };

    const remeasure = () => { measure(); shown = -1; schedule(); };
    remeasure();
    document.fonts?.ready.then(remeasure).catch(() => {});
    window.addEventListener('resize', remeasure);
    const unregister = register(schedule);

    return () => {
      unregister();
      window.removeEventListener('resize', remeasure);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [register]);

  return (
    <Link
      ref={rootRef}
      href="/teofilo-leal"
      className={styles.root}
      aria-label="Ver la reseña histórica de Teófilo Leal Berra"
    >
      <p className={styles.inMemoriam}>In Memoriam</p>
      <div className={styles.marco}>
        <Image
          src="/assets/img/acto3-cuadro-teofilo-leal-memoria.png"
          alt="Retrato de Teófilo Leal Berra"
          width={260}
          height={325}
          quality={100}
          sizes="(max-width: 768px) 300px, 520px"
          className={styles.retrato}
          draggable={false}
        />
      </div>
      <h2 className={styles.nombre}>Teófilo Leal<br />Berra</h2>
      <div className={styles.fechas}>
        <span>1866 — 1940</span>
      </div>
      <p className={styles.roles}>Actor · Poeta · Músico · Pintor</p>
      <p className={styles.epitafio}>
        Su memoria ilumina cada trabajo de esta Logia.
      </p>
    </Link>
  );
}
