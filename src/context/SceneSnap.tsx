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
import { useScrollEngine, type ScrollState } from '@/context/ScrollEngine';

// ── Config ────────────────────────────────────────────────────────────
const STATION_COUNT = 5;   // s1..s5
const DWELL_RATIO   = 0.35; // how far into station segment to target with goTo()

// ── Types ─────────────────────────────────────────────────────────────
export type PlayState = 'idle' | 'playing';

export interface SceneState {
  station: number;       // 0-4, current station (or origin during playing)
  target: number;        // same as station when idle; destination when playing
  playState: PlayState;
  direction: 1 | -1;
  /** 0→1 progress of the active transition. When idle = 1. */
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
 * Builds scrollY dwell positions for each station (used by goTo).
 * Station 0 (s1) = 0. Station N = end_of_transition_N + DWELL_RATIO * station_N_height.
 */
function buildDwells(): number[] {
  const vh          = window.innerHeight;
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

/**
 * Derives SceneState from ScrollEngine's ScrollState.
 *
 * Mapping (ScrollEngine stationIndex = transition index for transitions):
 *   t1 → stationIndex=0 → station=0, target=1, transitionIdx=0
 *   s2 → stationIndex=1 → station=1, idle
 *   t2 → stationIndex=1 → station=1, target=2, transitionIdx=1
 *   … etc.
 *
 * Direction is always 1 — with native scroll, localProgress already
 * decreases naturally when scrolling backward, so no inversion needed.
 */
function deriveSceneState(s: ScrollState): SceneState {
  // Page top: treat as idle at El Umbral so ScrollHint and UmbralOverlay
  // remain visible before the user starts scrolling.
  if (s.segmentId === 't1' && s.localProgress === 0) {
    return { station: 0, target: 0, playState: 'idle', direction: 1, progress: 1, transitionIdx: -1 };
  }

  if (s.type === 'transition') {
    const idx = s.stationIndex; // 0=t1, 1=t2, 2=t3, 3=t4
    return {
      station:      idx,
      target:       idx + 1,
      playState:    'playing',
      direction:    1,
      progress:     s.localProgress,
      transitionIdx: idx,
    };
  }

  // Station segment
  return {
    station:      s.stationIndex,
    target:       s.stationIndex,
    playState:    'idle',
    direction:    1,
    progress:     1,
    transitionIdx: -1,
  };
}

// ── Provider ──────────────────────────────────────────────────────────
export function SceneSnapProvider({ children }: { children: ReactNode }) {
  const stateRef     = useRef<SceneState>({
    station: 0, target: 0, playState: 'idle', direction: 1, progress: 1, transitionIdx: -1,
  });
  const callbacksRef = useRef<SceneCallback[]>([]);
  const dwellsRef    = useRef<number[]>([]);

  const { register: registerScroll } = useScrollEngine();

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

  /** Scroll natively to a station (used by NavDots). Respects prefers-reduced-motion. */
  const goTo = useCallback((target: number) => {
    if (target < 0 || target >= STATION_COUNT) return;
    const endY    = dwellsRef.current[target] ?? 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: endY, behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  // Build dwell positions and keep them in sync with viewport size changes
  useEffect(() => {
    dwellsRef.current = buildDwells();
    const onResize = () => { dwellsRef.current = buildDwells(); };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  // Subscribe to ScrollEngine — derive and re-emit as SceneState
  useEffect(() => {
    return registerScroll((scrollState: ScrollState) => {
      emit(deriveSceneState(scrollState));
    });
  }, [registerScroll, emit]);

  return <Ctx.Provider value={{ register, getState, goTo }}>{children}</Ctx.Provider>;
}

export function useSceneSnap(): SceneSnapCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSceneSnap must be inside SceneSnapProvider');
  return c;
}
