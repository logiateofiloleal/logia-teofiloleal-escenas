'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile, MOBILE_BREAKPOINT } from '@/hooks/useIsMobile';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import { SEGMENTS, type Transition, type Station } from '@/config/segments';
import { FrameLoader, getLiveBytes } from '@/lib/frameLoader';
import { resetPreloadGate, reportPreloadItemDone } from '@/lib/preloadGate';
import { scheduleIdle } from '@/lib/scheduleIdle';
import styles from './Canvas.module.css';

// Backing store dimensions MUST match frame dimensions exactly.
// Mismatch forces per-paint GPU rescaling.
const DESKTOP_W = 1280;
const DESKTOP_H = 720;
const MOBILE_W  = 480;
const MOBILE_H  = 854;

// ── Memory window ─────────────────────────────────────────────────────
// Only 3 transitions exist total, so a naive "keep everything until far
// behind" policy (the old releaseLag math) holds all of them decoded at
// once: ~1.4GB on desktop, ~640MB on mobile — the main cause of lag/OOM.
//
// Two independent mechanisms, deliberately not merged into one pass:
//
// 1. Window pass (releaseOutsideWindow) — runs once per transition ENTRY.
//    Distance is measured in transition-ordinal terms (t1=0, t2=1, t3=2),
//    not raw SEGMENTS index, since transitions sit 2 apart in SEGMENTS
//    (stations in between). LOOKBEHIND is 0: once you've moved past a
//    transition, its window slot is gone — the lp<0.4 "prefetch previous"
//    check below re-fetches it on demand if the visitor actually scrolls
//    back. (An earlier version kept LOOKBEHIND=1 on desktop, but with
//    exactly 3 transitions this makes the *middle* one's window span all
//    3, and — worse — mixing that with the reverse-prefetch below caused
//    a fetch/evict/fetch loop each time lp dipped under 0.4. Measured
//    with the memdebug overlay: dropped straight to all 390 frames/
//    ~1.4GB resident. Keeping the window strict and letting the budget
//    pass catch the rest avoids both problems.)
//
// 2. Budget pass (enforceBudget) — a hard byte ceiling, re-checked right
//    after every new loader is admitted (not only at transition entry).
//    It's the real backstop for the case the window pass can't prevent:
//    scrolling forward past 60% (prefetches next) then reversing below
//    40% within the same transition (re-fetches previous) can legitimately
//    have 3 transitions resident at once. It always spares the active
//    transition and releases whichever remaining one is ordinally
//    furthest first.
const LOOKAHEAD          = 1;
const LOOKBEHIND         = 0;
const MEM_BUDGET_MOBILE  = 480 * 1024 * 1024;  // fits 2 mobile transitions (~407MB), not 3 (~610MB)
const MEM_BUDGET_DESKTOP = 1100 * 1024 * 1024; // fits 2 desktop transitions (~914MB), not 3 (~1371MB)

// Smooths the mapping from scroll-derived progress to displayed frame index
// so irregular scroll-event timing doesn't read as jank. Runs in its own
// rAF loop, decoupled from the scroll-driven SceneSnap callback.
const LERP_ALPHA   = 0.18;
const LERP_EPSILON = 0.002; // well under one frame step (1/129 ≈ 0.0078)

// Transitions sit 2 slots apart in SEGMENTS — each is followed by a station
// before the next transition, e.g. [t1, s2, t2, s3, t3, s4].
const NEXT_TRANSITION_STEP = 2;

function ss(e0: number, e1: number, v: number): number {
  const x = Math.min(Math.max((v - e0) / (e1 - e0), 0), 1);
  return x * x * (3 - 2 * x);
}

// Pre-typed segment arrays (static, computed once)
const TRANSITIONS = SEGMENTS.filter((s): s is Transition => s.type === 'transition');
const STATIONS    = SEGMENTS.filter((s): s is Station    => s.type === 'station');

function effectiveFrameCount(t: Transition, isMobile: boolean): number {
  if (isMobile && t.frameCountMobile != null) return t.frameCountMobile;
  return t.frameCount;
}

function effectiveStartImg(t: Transition, isMobile: boolean): string {
  if (isMobile && t.startImgMobile) return t.startImgMobile;
  return t.startImg;
}

/** Ordinal position of a transition id among TRANSITIONS (t1=0, t2=1, …). */
function transitionOrdinal(id: string): number {
  return TRANSITIONS.findIndex(t => t.id === id);
}

export default function Canvas() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const isMobile   = useIsMobile();
  const { register, getState } = useSceneSnap();

  const W          = isMobile ? MOBILE_W  : DESKTOP_W;
  const H          = isMobile ? MOBILE_H  : DESKTOP_H;
  const frameBytes = W * H * 4; // decoded RGBA size of one frame — memory accounting unit

  // Preloaded stills — HTMLImageElement (sync drawImage once .complete)
  const imgsRef    = useRef<Map<string, HTMLImageElement>>(new Map());

  // FrameLoader per transition id (lazy, only for mode:'frames')
  const loadersRef   = useRef<Map<string, FrameLoader>>(new Map());
  const lastFrameRef = useRef<Map<string, number>>(new Map()); // guard redundant draws

  // SEGMENTS index of the currently-active transition — kept up to date by
  // the draw loop below, read by startLoader's budget check so a loader
  // admitted from a deferred (scheduleIdle) prefetch still knows what's
  // "active" at the time it actually lands, not when it was scheduled.
  const activeSegIdxRef = useRef(0);

  // Read once at mount, same pattern as useIsMobile — avoids reloading
  // assets mid-session if the OS setting changes.
  const prefersReducedMotionRef = useRef(false);

  // ── Backing store ────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width  = W;
    c.height = H;
  }, [W, H]);

  // ── Reduced motion detection (must run before the preload effect below) ──
  useEffect(() => {
    prefersReducedMotionRef.current =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // ── Draw helpers ─────────────────────────────────────────

  const drawImg = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement, scale: number, filter: string) => {
      ctx.save();
      ctx.filter = filter;
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);

      if (isMobile) {
        // Letterbox: 16:9 image centered in 9:16 canvas with black bars.
        const drawH   = Math.round(W / (16 / 9));
        const offsetY = Math.round((H - drawH) / 2);
        ctx.drawImage(img, 0, offsetY, W, drawH);
        ctx.restore();
        ctx.fillStyle = '#050302';
        if (offsetY > 0) {
          ctx.fillRect(0, 0, W, offsetY);
          ctx.fillRect(0, H - offsetY, W, offsetY);
        }
      } else {
        ctx.drawImage(img, 0, 0, W, H);
        ctx.restore();
      }
    },
    [W, H, isMobile],
  );

  // ── Preload all stills + first transition's frames ───────
  // The Preloader stays visible until this gate reports ready — no fixed
  // timers. window.innerWidth is read directly (not the isMobile prop)
  // because useIsMobile settles one tick after mount; using the prop here
  // could eager-load the wrong (desktop) frame directory for mobile users.
  useEffect(() => {
    const srcs = new Set<string>();
    for (const seg of SEGMENTS) {
      if (seg.type === 'station') srcs.add(seg.frameImg);
      else { srcs.add(seg.startImg); srcs.add(seg.endImg); }
    }
    const t0 = TRANSITIONS[0];
    const firstFrameSrc = t0 ? effectiveStartImg(t0, isMobile) : undefined;
    // Also preload mobile first-frame fallbacks
    for (const seg of SEGMENTS) {
      if (seg.type !== 'station' && isMobile && seg.startImgMobile) srcs.add(seg.startImgMobile);
    }

    const mobileNow = typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;
    const t0FrameCount = t0 ? effectiveFrameCount(t0, mobileNow) : 0;
    const reducedMotion = prefersReducedMotionRef.current;

    // Gate waits for every still PLUS all of t0's frames — intentional:
    // the Preloader stays up until the first scene can scrub smoothly from
    // frame 1, not just until it can start loading. Reduced-motion visitors
    // never fetch the frame sequence at all (see drawTransitionFrames
    // below), so there's no extra count to wait for.
    resetPreloadGate(srcs.size + (reducedMotion ? 0 : t0FrameCount));

    srcs.forEach(src => {
      const existing = imgsRef.current.get(src);
      if (existing) {
        if (existing.complete) reportPreloadItemDone();
        else {
          existing.addEventListener('load', reportPreloadItemDone, { once: true });
          existing.addEventListener('error', reportPreloadItemDone, { once: true });
        }
        return;
      }
      const img = new Image();
      img.addEventListener('load', reportPreloadItemDone, { once: true });
      img.addEventListener('error', reportPreloadItemDone, { once: true });
      img.src = src;
      imgsRef.current.set(src, img);
      if (src === firstFrameSrc) {
        const drawFirst = () => {
          const s = getState();
          if (s.playState !== 'idle' || s.station !== 0) return;
          const c = canvasRef.current;
          if (!c) return;
          const ctx = c.getContext('2d');
          if (!ctx) return;
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
        };
        if (img.complete) drawFirst();
        else img.addEventListener('load', drawFirst, { once: true });
      }
    });

    if (!reducedMotion && t0 && t0.mode === 'frames' && t0FrameCount > 0 && !loadersRef.current.has(t0.id)) {
      const t0FrameBytes = mobileNow ? MOBILE_W * MOBILE_H * 4 : DESKTOP_W * DESKTOP_H * 4;
      const loader = new FrameLoader(t0, mobileNow, t0FrameBytes);
      loadersRef.current.set(t0.id, loader);
      loader.load(reportPreloadItemDone);
    }
  }, [W, H, isMobile, getState]);

  const drawStation = useCallback(
    (ctx: CanvasRenderingContext2D, frameImg: string, lp: number) => {
      const img = imgsRef.current.get(frameImg);
      if (!img?.complete || img.naturalWidth === 0) return;
      const scale      = 1.045 - lp * 0.035;
      const brightness = 0.82  + lp * 0.10;
      const saturate   = 1.04  + lp * 0.04;
      drawImg(ctx, img, scale, `brightness(${brightness}) contrast(1.06) saturate(${saturate})`);
    },
    [drawImg],
  );

  const drawTransitionStills = useCallback(
    (ctx: CanvasRenderingContext2D, startImg: string, endImg: string, lp: number) => {
      const imgA = imgsRef.current.get(startImg);
      const imgB = imgsRef.current.get(endImg);
      if (!imgA?.complete) return;

      drawImg(ctx, imgA, 1.010, 'brightness(0.92) contrast(1.06) saturate(1.08)');

      if (imgB?.complete && imgB.naturalWidth > 0) {
        const t          = ss(0.1, 0.9, lp);
        const brightness = 0.82 + t * 0.10;
        const saturate   = 1.04 + t * 0.04;
        const scaleB     = 1.045 - t * 0.010;
        ctx.save();
        ctx.globalAlpha = t;
        drawImg(ctx, imgB, scaleB, `brightness(${brightness}) contrast(1.06) saturate(${saturate})`);
        ctx.restore();
      }
    },
    [drawImg],
  );

  const releaseLoader = useCallback((id: string) => {
    loadersRef.current.get(id)?.release();
    loadersRef.current.delete(id);
    lastFrameRef.current.delete(id);
  }, []);

  /**
   * Window pass — called once per transition ENTRY (not per frame, not per
   * loader). Releases any loader whose ordinal distance from the active
   * transition falls outside [-LOOKBEHIND, +LOOKAHEAD]. See the comment
   * above the LOOKAHEAD/LOOKBEHIND constants for why this alone doesn't
   * fully bound memory, and what enforceBudget below adds.
   */
  const releaseOutsideWindow = useCallback(
    (activeSegIdx: number) => {
      const activeId      = SEGMENTS[activeSegIdx]?.id;
      const activeOrdinal = activeId ? transitionOrdinal(activeId) : -1;
      for (const id of Array.from(loadersRef.current.keys())) {
        if (id === activeId) continue;
        const dist = transitionOrdinal(id) - activeOrdinal;
        if (dist < -LOOKBEHIND || dist > LOOKAHEAD) releaseLoader(id);
      }
    },
    [releaseLoader],
  );

  /**
   * Budget pass — a hard byte ceiling. Called after the window pass on
   * every transition entry, AND right after any single loader is admitted
   * (prefetch or lazy-init), since prefetching-ahead-then-reversing can
   * put 3 transitions in memory between transition-entry events. Never
   * releases the active transition; releases whichever remaining loader
   * is ordinally furthest from active first.
   */
  const enforceBudget = useCallback(
    (activeSegIdx: number) => {
      const budget         = isMobile ? MEM_BUDGET_MOBILE : MEM_BUDGET_DESKTOP;
      const activeId       = SEGMENTS[activeSegIdx]?.id;
      const activeOrdinal  = activeId ? transitionOrdinal(activeId) : -1;

      while (getLiveBytes() > budget && loadersRef.current.size > 1) {
        let furthestId: string | null = null;
        let furthestDist = -1;
        for (const id of loadersRef.current.keys()) {
          if (id === activeId) continue;
          const dist = Math.abs(transitionOrdinal(id) - activeOrdinal);
          if (dist > furthestDist) { furthestDist = dist; furthestId = id; }
        }
        if (!furthestId) break; // only the active loader is left — stop
        releaseLoader(furthestId);
      }
    },
    [isMobile, releaseLoader],
  );

  /**
   * Starts a loader for `seg` if it's a not-yet-loaded frames transition.
   * Doesn't check the budget itself — frames decode asynchronously, so
   * bytes are ~0 right after admission; the driver's per-tick enforceBudget
   * call (below) is what actually catches the budget being crossed once
   * decoding has progressed.
   */
  const startLoader = useCallback(
    (seg: Transition) => {
      if (loadersRef.current.has(seg.id)) return;
      if (seg.mode !== 'frames' || effectiveFrameCount(seg, isMobile) === 0) return;
      const loader = new FrameLoader(seg, isMobile, frameBytes);
      loadersRef.current.set(seg.id, loader);
      loader.load();
    },
    [isMobile, frameBytes],
  );

  const drawTransitionFrames = useCallback(
    (ctx: CanvasRenderingContext2D, transition: Transition, lp: number, segIdx: number) => {
      // Reduced motion: never fetch/decode the 130-frame sequence — show the
      // transition's resting end state as a single static image instead.
      if (prefersReducedMotionRef.current) {
        drawTransitionStills(ctx, transition.startImg, transition.endImg, 1);
        return;
      }

      const fc = effectiveFrameCount(transition, isMobile);
      if (fc === 0) {
        drawTransitionStills(ctx, transition.startImg, transition.endImg, lp);
        return;
      }

      // Lazy init loader (no-op if already loading/loaded)
      startLoader(transition);
      const loader = loadersRef.current.get(transition.id);
      if (!loader) return; // startLoader declined (shouldn't happen — fc > 0 checked above)

      const targetIdx = Math.floor(lp * (fc - 1));
      const lastDrawn = lastFrameRef.current.get(transition.id) ?? -2;

      if (targetIdx === lastDrawn) return; // no-op guard

      const frame = loader.getFrame(targetIdx) ?? loader.nearestFrame(targetIdx);
      if (frame) {
        ctx.drawImage(frame, 0, 0, W, H);
        loader.setLastDrawn(targetIdx);
        lastFrameRef.current.set(transition.id, targetIdx);
      } else if (!lastFrameRef.current.has(transition.id)) {
        // No frames decoded yet — show startImg so canvas isn't black
        const startSrc = effectiveStartImg(transition, isMobile);
        const still = imgsRef.current.get(startSrc);
        if (still?.complete && still.naturalWidth > 0) {
          ctx.drawImage(still, 0, 0, W, H);
        }
      }
      // else: keep last valid frame on canvas (no clear)

      // Prefetch the next transition once we're most of the way through this
      // one, and the previous transition if scrolling back near the start
      // (covers reversing direction without a visible stall). Scheduled on
      // idle so it never competes with the active scrub's decode work.
      if (lp > 0.6) {
        const nextIdx = segIdx + NEXT_TRANSITION_STEP;
        const next = SEGMENTS[nextIdx];
        if (next?.type === 'transition' && !loadersRef.current.has(next.id)) {
          scheduleIdle(() => startLoader(next));
        }
      } else if (lp < 0.4) {
        const prevIdx = segIdx - NEXT_TRANSITION_STEP;
        const prev = SEGMENTS[prevIdx];
        if (prev?.type === 'transition' && !loadersRef.current.has(prev.id)) {
          scheduleIdle(() => startLoader(prev));
        }
      }
    },
    [drawTransitionStills, isMobile, W, H, startLoader],
  );

  // ── Target state (written by SceneSnap, read by the rAF loop below) ──
  const targetStateRef = useRef<SceneState>({
    station: 0, target: 0, playState: 'idle', direction: 1, progress: 1, transitionIdx: -1,
  });

  useEffect(() => {
    return register((state: SceneState) => {
      targetStateRef.current = state;
      ensureLoopRunningRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register]);

  // ── Draw loop: decoupled from the scroll-event cadence ──────
  // SceneSnap/ScrollEngine update targetStateRef at scroll-event rate; this
  // rAF loop separately lerps toward it and draws every animation frame,
  // smoothing out irregular scroll-event timing. It parks itself (no more
  // rAF calls) once caught up and idle, and is woken by the register
  // callback above whenever a new target arrives.
  const displayLpRef      = useRef(0);
  const activeTransIdRef  = useRef<string | null>(null);
  const rafIdRef          = useRef<number | null>(null);
  const loopRunningRef    = useRef(false);
  const ensureLoopRunningRef = useRef<() => void>(() => {});

  useEffect(() => {
    const driver = () => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!ctx) { rafIdRef.current = requestAnimationFrame(driver); return; }

      const state = targetStateRef.current;
      let keepGoing = false;

      if (state.playState === 'playing') {
        const trans = TRANSITIONS[state.transitionIdx];
        if (trans) {
          const segIdx    = SEGMENTS.indexOf(trans);
          const targetLp  = state.direction === 1 ? state.progress : 1 - state.progress;

          if (activeTransIdRef.current !== trans.id) {
            // Entering a new transition — snap (no cross-segment lerp) and
            // release anything outside the new window.
            activeTransIdRef.current = trans.id;
            activeSegIdxRef.current  = segIdx;
            displayLpRef.current     = targetLp;
            releaseOutsideWindow(segIdx);
          } else {
            displayLpRef.current += (targetLp - displayLpRef.current) * LERP_ALPHA;
          }

          const lp = displayLpRef.current;

          if (trans.mode === 'stills' || trans.frameCount === 0) {
            ctx.clearRect(0, 0, W, H);
            drawTransitionStills(ctx, trans.startImg, trans.endImg, lp);
          } else {
            // Frames: do NOT pre-clear — keep last valid frame while loading
            drawTransitionFrames(ctx, trans, lp, segIdx);
          }

          // Checked every tick, not just on entry: decoded bytes trickle in
          // asynchronously as fetches resolve, so the moment a loader
          // actually crosses the budget can land well after it was admitted.
          enforceBudget(segIdx);

          keepGoing = Math.abs(targetLp - displayLpRef.current) > LERP_EPSILON;
        }
      } else {
        // idle — only station 0 needs an explicit draw (initial mount).
        // Stations 1-4: keep whatever the transition left on canvas —
        // the last painted frame IS the correct still, no visual jump.
        activeTransIdRef.current = null;
        enforceBudget(activeSegIdxRef.current);
        if (state.station === 0) {
          const t0       = TRANSITIONS[0];
          const startSrc = t0 ? effectiveStartImg(t0, isMobile) : undefined;
          const img      = startSrc ? imgsRef.current.get(startSrc) : undefined;
          if (img?.complete && img.naturalWidth > 0) {
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(img, 0, 0, W, H); // raw — matches FrameLoader bitmap render
          }
        }
        // else: no-op — last transition frame stays on canvas
      }

      if (keepGoing) {
        rafIdRef.current = requestAnimationFrame(driver);
      } else {
        loopRunningRef.current = false;
        rafIdRef.current = null;
      }
    };

    ensureLoopRunningRef.current = () => {
      if (loopRunningRef.current) return;
      loopRunningRef.current = true;
      rafIdRef.current = requestAnimationFrame(driver);
    };

    // Draw the initial state immediately (mirrors the old register-fires-
    // synchronously-on-subscribe behavior) instead of waiting a frame.
    ensureLoopRunningRef.current();

    return () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      loopRunningRef.current = false;
    };
  }, [drawTransitionStills, drawTransitionFrames, releaseOutsideWindow, enforceBudget, isMobile, W, H]);

  // ── Release everything on unmount (route change, etc.) ──────
  useEffect(() => {
    return () => {
      for (const loader of loadersRef.current.values()) loader.release();
      loadersRef.current.clear();
      lastFrameRef.current.clear();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
    />
  );
}
