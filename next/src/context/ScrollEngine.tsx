'use client';

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { SEGMENTS, HERO_VH, type Segment } from '@/config/segments';

export interface ScrollState {
  type: 'station' | 'transition';
  segmentId: string;
  localProgress: number;  // 0–1 within the current segment
  stationIndex: number;   // 0–4 (index among stations only)
  globalProgress: number; // 0–1 across the entire hero
}

type ScrollCallback = (state: ScrollState) => void;

interface ScrollEngineCtx {
  register: (cb: ScrollCallback) => () => void;
  getState: () => ScrollState;
}

const Ctx = createContext<ScrollEngineCtx | null>(null);

interface Boundary {
  start: number;
  end: number;
  segment: Segment;
  stationIndex: number;
}

function buildBoundaries(): Boundary[] {
  const vh = window.innerHeight;
  const result: Boundary[] = [];
  let cumulative = 0;
  let stIdx = 0;

  for (const seg of SEGMENTS) {
    const h = seg.scrollVh * vh;
    result.push({
      start: cumulative,
      end: cumulative + h,
      segment: seg,
      stationIndex: seg.type === 'station' ? stIdx++ : stIdx - 1,
    });
    cumulative += h;
  }
  return result;
}

function resolveState(scrollY: number, boundaries: Boundary[]): ScrollState {
  const totalPx = boundaries.at(-1)?.end ?? 1;

  for (const b of boundaries) {
    if (scrollY >= b.start && scrollY < b.end) {
      const lp = (scrollY - b.start) / (b.end - b.start);
      return {
        type: b.segment.type,
        segmentId: b.segment.id,
        localProgress: Math.max(0, Math.min(1, lp)),
        stationIndex: b.stationIndex,
        globalProgress: Math.max(0, Math.min(1, scrollY / totalPx)),
      };
    }
  }

  // Below the hero — freeze on last station
  return {
    type: 'station',
    segmentId: 's5',
    localProgress: 1,
    stationIndex: 4,
    globalProgress: 1,
  };
}

export function ScrollEngineProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<ScrollState>({
    type: 'station',
    segmentId: 's1',
    localProgress: 0,
    stationIndex: 0,
    globalProgress: 0,
  });

  const callbacksRef = useRef<ScrollCallback[]>([]);
  const tickingRef   = useRef(false);
  const boundariesRef = useRef<Boundary[]>([]);

  const emit = useCallback((state: ScrollState) => {
    stateRef.current = state;
    for (const cb of callbacksRef.current) cb(state);
  }, []);

  const register = useCallback((cb: ScrollCallback) => {
    callbacksRef.current.push(cb);
    cb(stateRef.current); // immediate call with current state
    return () => {
      callbacksRef.current = callbacksRef.current.filter(c => c !== cb);
    };
  }, []);

  const getState = useCallback(() => stateRef.current, []);

  useEffect(() => {
    boundariesRef.current = buildBoundaries();

    const onResize = () => { boundariesRef.current = buildBoundaries(); };

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        emit(resolveState(window.scrollY, boundariesRef.current));
        tickingRef.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    // Initial fire
    emit(resolveState(window.scrollY, boundariesRef.current));

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [emit]);

  return <Ctx.Provider value={{ register, getState }}>{children}</Ctx.Provider>;
}

export function useScrollEngine(): ScrollEngineCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useScrollEngine must be used inside ScrollEngineProvider');
  return ctx;
}
