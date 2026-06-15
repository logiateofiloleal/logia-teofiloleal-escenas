'use client';

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { SEGMENTS } from '@/config/segments';

// ── Config ────────────────────────────────────────────────────────────
const DURATION_FRAMES = 5500; // ms — real-frame transitions (t1)
const DURATION_STILLS = 1800; // ms — cross-fade transitions
const COOLDOWN_MS     = 600;  // ms — minimum gap between gestures
const STATION_COUNT   = 5;    // s1..s5
const DWELL_RATIO     = 0.35; // how far into station segment to stop (copy visible at ≥0.25)

// ── Types ─────────────────────────────────────────────────────────────
export type PlayState = 'idle' | 'playing';

export interface SceneState {
  station: number;       // 0-4, current station (or origin during playing)
  target: number;        // same as station when idle; destination when playing
  playState: PlayState;
  direction: 1 | -1;
  /** 0→1 progress of the active transition (eased). When idle = 1. */
  progress: number;
  /** Index into the transitions-only array. -1 when idle. */
  transitionIdx: number;
}

type SceneCallback = (s: SceneState) => void;

interface SceneSnapCtx {
  register: (cb: SceneCallback) => () => void;
  getState: () => SceneState;
  goTo: (target: number) => void;
}

const Ctx = createContext<SceneSnapCtx | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Builds scrollY dwell positions for each station.
 * Station 0 (s1) = 0. Station N = end_of_transition_N + DWELL_RATIO * station_N_height.
 * Used only to keep ScrollEngine / StationCopyWrapper in sync via window.scrollTo.
 */
function buildDwells(): number[] {
  const vh = window.innerHeight;
  const transitions = SEGMENTS.filter(s => s.type === 'transition');
  const stations    = SEGMENTS.filter(s => s.type === 'station');
  const dwells: number[] = [0];
  let cumPx = 0;
  for (let i = 0; i < transitions.length; i++) {
    cumPx += (transitions[i].scrollVh / 100) * vh;
    const stPx = ((stations[i]?.scrollVh ?? 80) / 100) * vh;
    dwells.push(cumPx + stPx * DWELL_RATIO);
    cumPx += stPx;
  }
  return dwells;
}

function cinematicEase(t: number): number {
  return t * t * (3 - 2 * t); // smoothstep easeInOut
}

function transitionDuration(fromStation: number): number {
  const ts = SEGMENTS.filter(s => s.type === 'transition');
  const idx = Math.min(Math.max(fromStation, 0), ts.length - 1);
  const seg = ts[idx];
  if (seg?.type !== 'transition') return DURATION_STILLS;
  if (seg.mode === 'frames' && seg.frameCount > 0) return seg.durationMs ?? DURATION_FRAMES;
  return DURATION_STILLS;
}

// ── Provider ──────────────────────────────────────────────────────────
export function SceneSnapProvider({ children }: { children: ReactNode }) {
  const stateRef     = useRef<SceneState>({
    station: 0, target: 0, playState: 'idle', direction: 1, progress: 1, transitionIdx: -1,
  });
  const callbacksRef = useRef<SceneCallback[]>([]);
  const dwellsRef    = useRef<number[]>([]);
  const rafRef       = useRef<number>(0);
  const lastEndRef   = useRef<number>(-Infinity);

  const emit = useCallback((s: SceneState) => {
    stateRef.current = s;
    for (const cb of callbacksRef.current) cb(s);
  }, []);

  const register = useCallback((cb: SceneCallback) => {
    callbacksRef.current.push(cb);
    cb(stateRef.current);
    return () => { callbacksRef.current = callbacksRef.current.filter(c => c !== cb); };
  }, []);

  const getState = useCallback(() => stateRef.current, []);

  const goTo = useCallback((target: number) => {
    const cur = stateRef.current;
    if (cur.playState === 'playing') return;
    if (target === cur.station)     return;
    if (target < 0 || target >= STATION_COUNT) return;

    const reduced      = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const endY         = dwellsRef.current[target] ?? 0;
    const dir: 1 | -1  = target > cur.station ? 1 : -1;
    const fromSt       = Math.min(cur.station, target);
    const transIdx     = fromSt; // transition 0=t1, 1=t2, 2=t3, 3=t4
    const duration     = transitionDuration(fromSt);

    if (reduced) {
      window.scrollTo(0, endY);
      lastEndRef.current = performance.now();
      emit({ station: target, target, playState: 'idle', direction: dir, progress: 1, transitionIdx: -1 });
      return;
    }

    emit({ station: cur.station, target, playState: 'playing', direction: dir, progress: 0, transitionIdx: transIdx });
    cancelAnimationFrame(rafRef.current);

    const startY    = window.scrollY;
    const startTime = performance.now();

    function tick(now: number) {
      const t  = Math.min((now - startTime) / duration, 1);
      const p  = cinematicEase(t);

      // Keep scrollY in sync for ScrollEngine/StationCopyWrapper
      window.scrollTo(0, startY + (endY - startY) * p);

      // Emit progress directly — Canvas reads this, no scroll-event chain needed
      emit({ station: cur.station, target, playState: 'playing', direction: dir, progress: p, transitionIdx: transIdx });

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        window.scrollTo(0, endY);
        lastEndRef.current = performance.now();
        emit({ station: target, target, playState: 'idle', direction: dir, progress: 1, transitionIdx: -1 });
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [emit]);

  useEffect(() => {
    dwellsRef.current = buildDwells();
    const onResize = () => { dwellsRef.current = buildDwells(); };

    let touchStartY = 0;

    const handleDelta = (deltaY: number): boolean => {
      const cur = stateRef.current;
      if (cur.station >= STATION_COUNT - 1 && deltaY > 0) return false; // release to Cierre
      if (cur.station <= 0 && deltaY < 0)                 return false; // release at top
      if (cur.playState === 'playing')                     return true;  // absorb, block
      if (performance.now() - lastEndRef.current < COOLDOWN_MS) return true;
      if (Math.abs(deltaY) < 1)                           return false;

      const next = cur.station + (deltaY > 0 ? 1 : -1);
      if (next < 0 || next >= STATION_COUNT) return false;
      goTo(next);
      return true;
    };

    const onWheel = (e: WheelEvent) => {
      const hero = document.getElementById('storyHero');
      if (hero) {
        const r = hero.getBoundingClientRect();
        if (r.top > window.innerHeight || r.bottom < 0) return;
      }
      if (handleDelta(e.deltaY)) e.preventDefault();
    };

    const onTouchStart = (e: TouchEvent) => { touchStartY = e.touches[0].clientY; };
    const onTouchEnd   = (e: TouchEvent) => {
      handleDelta((touchStartY - e.changedTouches[0].clientY) * 2.5);
    };

    window.addEventListener('wheel',       onWheel,      { passive: false });
    window.addEventListener('touchstart',  onTouchStart, { passive: true });
    window.addEventListener('touchend',    onTouchEnd,   { passive: true });
    window.addEventListener('resize',      onResize);

    return () => {
      window.removeEventListener('wheel',      onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend',   onTouchEnd);
      window.removeEventListener('resize',     onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [goTo]);

  return <Ctx.Provider value={{ register, getState, goTo }}>{children}</Ctx.Provider>;
}

export function useSceneSnap(): SceneSnapCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSceneSnap must be inside SceneSnapProvider');
  return c;
}
