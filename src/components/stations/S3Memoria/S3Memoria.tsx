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

// Timeline inside s3 (p 0 → 1). The station's resting point — where the
// NavDots and the menu land — is p = 0.35 (stationScroll DWELL_RATIO).
// Everything settles BEFORE it: the portrait arrives first (≈ 86 % of the
// way to the resting point), then depth of field and the tribute finish
// just after, and the rest of s3 is a still, contemplative hold.
const TRAVEL: [number, number] = [0.00, 0.30];          // position + scale
const TURN: [number, number] = [0.00, 0.26];            // −14° → frontal, done before arrival
const BLUR: [number, number] = [0.02, 0.32];            // depth of field settles after the portrait
const TEXTS: [string, number, number][] = [              // staggered text reveal
  ['inMemoriam', 0.12, 0.22],
  ['nombre',     0.15, 0.25],
  ['fechas',     0.18, 0.28],
  ['roles',      0.21, 0.31],
  ['epitafio',   0.24, 0.33],
];
const LOCAL_VEIL: [number, number] = [0.12, 0.32];      // radial behind the text block
const RESTING_TURN_DEG = -14;                            // .marco's desktop tilt
// Eases the displayed progress toward the scroll position (same idea as the
// canvas frame lerp) so a mouse-wheel step animates instead of jumping.
// Slightly softer than the canvas: the travel is short (0–0.30 of 80vh), so
// one wheel step covers almost half of it.
const LERP = 0.16;
const LERP_EPSILON = 0.0005;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const ss = (a: number, b: number, v: number) => { const x = clamp01((v - a) / (b - a)); return x * x * (3 - 2 * x); };
// Arrival curve: smootherstep (zero velocity AND acceleration at both ends —
// soft departure, no perceptible stop) on a slightly warped time, which
// moves the speed peak to ~42 % and leaves a longer, gentler deceleration
// into the centre. Monotonic: no overshoot or settling back.
const smootherstep = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const llegada = (t: number) => smootherstep(clamp01(t) ** 0.8);
const fase = ([a, b]: [number, number], p: number) => llegada((p - a) / (b - a));

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
    // Section's document-space top and height, cached by measure(): reading
    // getBoundingClientRect on every scroll frame forced a synchronous layout
    // right after the other subscribers had dirtied styles.
    let secTop = 0;
    let secH = 1;
    // Inputs of the last apply() — identical inputs leave every output as is.
    let lastP = -1;
    let lastPanelOp = -1;
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
      secTop = section.getBoundingClientRect().top + window.scrollY;
      secH = section.offsetHeight || 1;
      lastP = -1; // force the next apply() to write

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
      const target = reduced ? 1 : clamp01((window.scrollY - secTop) / secH);
      shown = shown < 0 || reduced ? target : shown + (target - shown) * LERP;
      if (Math.abs(target - shown) < LERP_EPSILON) shown = target;
      const p = shown;
      const panelOp = parseFloat(panel.style.opacity) || 0;
      if (p === lastP && panelOp === lastPanelOp) return;
      lastP = p;
      lastPanelOp = panelOp;
      const e = reduced ? 1 : fase(TRAVEL, p);
      const k = 1 - e;
      const kTurn = reduced ? 0 : 1 - fase(TURN, p);
      setVars(geom.dx * k, geom.dy * k, 1 + (geom.scale - 1) * k, geom.turn * kTurn);
      for (const [el, a, b] of texts) if (el) el.style.opacity = String(reduced ? 1 : ss(a, b, p));
      panel.style.setProperty('--s3-local', String(reduced ? 1 : ss(LOCAL_VEIL[0], LOCAL_VEIL[1], p)));
      // Depth of field follows the arrival (settling just after it) and
      // fades with the block itself (StationCopyWrapper drives the panel's
      // opacity on entry/exit).
      const op = (reduced ? 1 : fase(BLUR, p)) * panelOp;
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
