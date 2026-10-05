'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useFrameTier, readFrameTier } from '@/hooks/useFrameTier';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import { SEGMENTS, tierAssets, type Transition, type Station, type FrameTier } from '@/config/segments';
import { FrameLoader, frameScheduler, getLiveBytes } from '@/lib/frameLoader';
import { expectPreloadItems, reportPreloadItemDone, isPreloadReady, subscribePreload } from '@/lib/preloadGate';
import { recordDraw } from '@/lib/perfProbe';
import styles from './Canvas.module.css';

// Backing store dimensions MUST match frame dimensions exactly.
// Mismatch forces per-paint GPU rescaling. The CSS box is always the full
// viewport with object-fit: cover (Canvas.module.css), so the backing's
// aspect ratio is preserved and any mismatch with the viewport is cropped.
const DIMS: Record<FrameTier, readonly [number, number]> = {
  desktop: [1280, 720],
  tablet:  [960, 540],
  mobile:  [480, 854],
};
const frameBytesFor = (tier: FrameTier) => DIMS[tier][0] * DIMS[tier][1] * 4;

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
const LOOKAHEAD          = 2; // all later transitions keep (at least) their coarse pass
const LOOKBEHIND         = 0;
const MB = 1024 * 1024;
const MEM_BUDGET: Record<FrameTier, number> = {
  // One full transition (mobile ~203MB, tablet ~257MB, desktop ~457MB) plus the
  // coarse passes of its neighbour. The scheduler (frameLoader.ts) only admits
  // a non-active scene's frame while it still fits.
  mobile:  256 * MB,
  tablet:  320 * MB,
  desktop: 640 * MB,
};

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

const effectiveFrameCount = (t: Transition, tier: FrameTier) => tierAssets(t, tier).frameCount;
const effectiveStartImg   = (t: Transition, tier: FrameTier) => tierAssets(t, tier).startImg;
const effectiveEndImg     = (t: Transition, tier: FrameTier) => tierAssets(t, tier).endImg;

/** Ordinal position of a transition id among TRANSITIONS (t1=0, t2=1, …). */
function transitionOrdinal(id: string): number {
  return TRANSITIONS.findIndex(t => t.id === id);
}

export default function Canvas() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const tier       = useFrameTier();
  const { register } = useSceneSnap();

  const [W, H]     = DIMS[tier];

  // Preloaded stills — HTMLImageElement (sync drawImage once .complete)
  const imgsRef    = useRef<Map<string, HTMLImageElement>>(new Map());

  // FrameLoader per transition id (lazy, only for mode:'frames')
  const loadersRef   = useRef<Map<string, FrameLoader>>(new Map());
  const lastFrameRef = useRef<Map<string, number>>(new Map()); // guard redundant draws

  // SEGMENTS index of the currently-active transition — kept up to date by
  // the draw loop below, read by startLoader's budget check so a loader
  // admitted by an earlier-scheduled prefetch still knows what's
  // "active" at the time it actually lands, not when it was scheduled.
  const activeSegIdxRef = useRef(0);

  // Loaders the budget pass just released, barred from being re-created for as
  // long as the same transition stays active — otherwise "prefetch → over
  // budget → release → prefetch" would re-download them in a loop.
  // Tier the frame loaders are built for: read from the viewport at mount (like
  // the preload effect). `tier` from useFrameTier is still 'desktop' during the
  // first render, and loaders created then — now possible from the very first
  // draw tick, since later scenes get their loader early — would fetch desktop
  // frames on a phone and account them at desktop size.
  const loaderTierRef = useRef<FrameTier>('desktop');
  const budgetReleasedRef = useRef<{ forSeg: number; ids: Set<string> }>({ forSeg: -1, ids: new Set() });

  // Read once at mount, same pattern as useFrameTier — avoids reloading
  // assets mid-session if the OS setting changes.
  const prefersReducedMotionRef = useRef(false);

  // Scroll direction inside the active transition (its target progress went
  // down since the last change) — gates the prefetch of the previous one.
  const movingBackRef     = useRef(false);
  const lastTargetLpRef   = useRef(0);

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

  // Used by 'stills'-mode transitions (crossfade between two images). The
  // image is cover-fitted to the backing store — aspect ratio kept, overflow
  // cropped — so a still of another aspect ratio never letterboxes or
  // stretches (a no-op crop when it already matches the tier).
  const drawImg = useCallback(
    (ctx: CanvasRenderingContext2D, img: HTMLImageElement, scale: number, filter: string) => {
      ctx.save();
      ctx.filter = filter;
      ctx.translate(W / 2, H / 2);
      ctx.scale(scale, scale);
      ctx.translate(-W / 2, -H / 2);
      const s  = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      ctx.restore();
    },
    [W, H],
  );

  // ── Preload all stills + first transition's frames ───────
  // The Preloader stays visible until this gate reports ready — no fixed
  // timers. The tier is read straight from the viewport (readFrameTier), not
  // the tier prop: useFrameTier settles one render after mount, and using
  // the prop here could eager-load the desktop frames on a phone or tablet.
  useEffect(() => {
    const tierNow = readFrameTier();
    loaderTierRef.current = tierNow;

    const srcs = new Set<string>();
    // Desktop stills are the desktop tier's own; phones and tablets only need
    // their tier's first/last-frame stills (last frames are what the canvas
    // draws when resting at a station — see drawArrival), not 9 desktop JPEGs.
    for (const seg of SEGMENTS) {
      if (tierNow === 'desktop') {
        if (seg.type === 'station') srcs.add(seg.frameImg);
        else { srcs.add(seg.startImg); srcs.add(seg.endImg); }
      } else if (seg.type === 'transition') {
        srcs.add(effectiveStartImg(seg, tierNow));
        srcs.add(effectiveEndImg(seg, tierNow));
      }
    }
    const t0 = TRANSITIONS[0];
    frameScheduler.configure(tierNow, MEM_BUDGET[tierNow]);
    frameScheduler.gateOpen = isPreloadReady;
    const unsubscribeGate = subscribePreload(() => { if (isPreloadReady()) frameScheduler.pump(); });

    const reducedMotion = prefersReducedMotionRef.current;
    const t0Loader =
      !reducedMotion && t0 && t0.mode === 'frames' && effectiveFrameCount(t0, tierNow) > 0
        ? (loadersRef.current.get(t0.id) ?? new FrameLoader(t0, tierNow, frameBytesFor(tierNow)))
        : null;

    // Gate waits for every still PLUS t0's first (coarse) pass — every 8th
    // frame, so the first scene can already scrub anywhere within 4 frames of
    // the exact one. The finer passes keep loading behind the preloader's exit
    // (see FrameScheduler), instead of holding the whole page for all 130
    // frames. Reduced-motion visitors
    // never fetch the frame sequence at all (see drawTransitionFrames
    // below), so there's nothing extra to wait for. Keys are asset URLs, so
    // re-declaring on a re-run keeps whatever was already reported.
    const expected = Array.from(srcs);
    if (t0Loader) {
      expected.push(...t0Loader.coarseSrcs());
    }
    expectPreloadItems(expected);

    srcs.forEach(src => {
      const report = () => reportPreloadItemDone(src);
      const existing = imgsRef.current.get(src);
      if (existing) {
        if (existing.complete) report();
        else {
          existing.addEventListener('load', report, { once: true });
          existing.addEventListener('error', report, { once: true });
        }
        return;
      }
      const img = new Image();
      img.addEventListener('load', report, { once: true });
      img.addEventListener('error', report, { once: true });
      img.src = src;
      imgsRef.current.set(src, img);
    });
    // No first-paint drawing here: a load callback registered now would
    // capture this render's backing size and tier, and could fire after
    // useFrameTier settles and the backing store is resized — painting a
    // desktop-sized frame into the mobile canvas. The draw loop paints
    // El Umbral itself (current size and tier) and retries until the still
    // has loaded.

    if (t0 && t0Loader && !loadersRef.current.has(t0.id)) {
      loadersRef.current.set(t0.id, t0Loader);
      t0Loader.onFrameDone = reportPreloadItemDone;
      frameScheduler.setActive(t0Loader);
      frameScheduler.add(t0Loader);
    }

    return unsubscribeGate;
  }, []);

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
      const budget         = MEM_BUDGET[loaderTierRef.current];
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
        const blocked = budgetReleasedRef.current;
        if (blocked.forSeg !== activeSegIdx) { blocked.forSeg = activeSegIdx; blocked.ids.clear(); }
        blocked.ids.add(furthestId);
        releaseLoader(furthestId);
      }
    },
    [releaseLoader],
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
      const blocked = budgetReleasedRef.current;
      if (blocked.forSeg === activeSegIdxRef.current && blocked.ids.has(seg.id)) return;
      const loaderTier = loaderTierRef.current;
      if (seg.mode !== 'frames' || effectiveFrameCount(seg, loaderTier) === 0) return;
      frameScheduler.configure(loaderTier, MEM_BUDGET[loaderTier]);
      const loader = new FrameLoader(seg, loaderTier, frameBytesFor(loaderTier));
      loadersRef.current.set(seg.id, loader);
      frameScheduler.add(loader);
    },
    [],
  );

  /**
   * Draws the frame for `lp`. Returns false while the canvas shows a
   * stand-in (nearest decoded frame / start still) for a frame that is
   * still loading — the draw loop keeps ticking so the exact frame is
   * painted as soon as it decodes, instead of parking on the stand-in.
   */
  const drawTransitionFrames = useCallback(
    (ctx: CanvasRenderingContext2D, transition: Transition, lp: number, segIdx: number): boolean => {
      // Reduced motion: never fetch/decode the 130-frame sequence — show the
      // transition's resting end state as a single static image instead:
      // this tier's own last-frame still, painted exactly as normal mode
      // paints it at rest (same aspect ratio as the backing, no letterbox).
      if (prefersReducedMotionRef.current) {
        const still = imgsRef.current.get(effectiveEndImg(transition, tier));
        if (!still) return true;
        if (!still.complete) return false; // retry next tick (bounded by load/error)
        if (still.naturalWidth > 0) ctx.drawImage(still, 0, 0, W, H);
        return true;
      }

      const fc = effectiveFrameCount(transition, tier);
      if (fc === 0) {
        drawTransitionStills(ctx, transition.startImg, transition.endImg, lp);
        return true;
      }

      // Lazy init loader (no-op if already loading/loaded)
      startLoader(transition);
      const loader = loadersRef.current.get(transition.id);
      if (!loader) return true; // startLoader declined (shouldn't happen — fc > 0 checked above)

      frameScheduler.setActive(loader);
      const targetIdx = Math.floor(lp * (fc - 1));
      const lastDrawn = lastFrameRef.current.get(transition.id) ?? -2;

      if (targetIdx === lastDrawn) return true; // no-op guard

      const exact = loader.getFrame(targetIdx);
      const nearIdx = exact ? targetIdx : loader.nearestIndex(targetIdx);
      const frame = exact ?? (nearIdx >= 0 ? loader.getFrame(nearIdx) : null);
      recordDraw(transition.id, lp, nearIdx < 0 ? -1 : Math.abs(nearIdx - targetIdx));
      if (!exact) loader.want(targetIdx); // stand-in on screen: fetch this frame next
      if (frame) {
        ctx.drawImage(frame, 0, 0, W, H);
        // Only an exact hit is recorded — a stand-in is redrawn (and
        // replaced) on the next tick once the real frame has decoded.
        if (exact) {
          loader.setLastDrawn(targetIdx);
          lastFrameRef.current.set(transition.id, targetIdx);
        }
      } else if (!lastFrameRef.current.has(transition.id)) {
        // No frames decoded yet — show startImg so canvas isn't black
        const startSrc = effectiveStartImg(transition, tier);
        const still = imgsRef.current.get(startSrc);
        if (still?.complete && still.naturalWidth > 0) {
          ctx.drawImage(still, 0, 0, W, H);
        }
      }
      // else: keep last valid frame on canvas (no clear)

      // Every later transition gets a loader right away: the scheduler decides
      // when its frames go (coarse pass right after this scene's own, finer
      // passes behind the active scene's, all bounded by the memory budget —
      // see FrameScheduler), so there is no lp threshold to wait for. The
      // previous one is re-fetched only when scrolling back toward it: going
      // forward it was just released by the window pass, and re-fetching it
      // would only be undone by the budget.
      for (let k = 1; k <= LOOKAHEAD; k++) {
        const next = SEGMENTS[segIdx + k * NEXT_TRANSITION_STEP];
        if (next?.type === 'transition') startLoader(next);
      }
      if (lp < 0.4 && movingBackRef.current) {
        const prev = SEGMENTS[segIdx - NEXT_TRANSITION_STEP];
        if (prev?.type === 'transition' && !loadersRef.current.has(prev.id)) startLoader(prev);
      }

      return exact != null || !loader.isLoading;
    },
    [drawTransitionStills, tier, W, H, startLoader],
  );

  /**
   * Resting at station N (N ≥ 1): paints the real last frame of the
   * transition that arrives there. The transition's own last paint can't be
   * trusted to be that frame — the smoothing lerp is cut short when the
   * station takes over, and a fast scroll / NavDot / menu jump can cross a
   * transition before its frames have decoded (leaving its first frame or a
   * stand-in on canvas). The videos are continuous (last frame of tN ≈
   * first frame of tN+1), so this is also right when arriving backwards.
   * Returns false if nothing could be painted yet (still image loading).
   */
  const drawArrival = useCallback(
    (ctx: CanvasRenderingContext2D, station: number): boolean => {
      const prev = TRANSITIONS[station - 1];
      if (!prev) return true;
      const fc = effectiveFrameCount(prev, tier);

      // Reduced motion falls through to the still below (no loaders exist).
      if (prev.mode === 'stills' || fc === 0) {
        const a = imgsRef.current.get(prev.startImg);
        const b = imgsRef.current.get(prev.endImg);
        if (!a || !b) return true;
        if (!a.complete || !b.complete) return false;
        drawTransitionStills(ctx, prev.startImg, prev.endImg, 1);
        return true;
      }

      const last   = fc - 1;
      const loader = loadersRef.current.get(prev.id);
      const frame  = loader?.getFrame(last);
      if (loader && frame) {
        ctx.drawImage(frame, 0, 0, W, H);
        loader.setLastDrawn(last);
        lastFrameRef.current.set(prev.id, last);
        return true;
      }

      // Same image file as the last frame, preloaded as a still.
      const still = imgsRef.current.get(effectiveEndImg(prev, tier));
      if (!still) return true;
      if (!still.complete) return false;
      if (still.naturalWidth > 0) {
        ctx.drawImage(still, 0, 0, W, H);
        lastFrameRef.current.set(prev.id, last);
      }
      return true;
    },
    [drawTransitionStills, tier, W, H],
  );

  // ── Target state (written by SceneSnap, read by the rAF loop below) ──
  const targetStateRef = useRef<SceneState>({
    station: 0, target: 0, playState: 'idle', direction: 1, progress: 1, transitionIdx: -1,
  });

  useEffect(() => {
    return register((state: SceneState) => {
      targetStateRef.current = state;
      frameScheduler.noteScroll();
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
  // Station whose arrival frame is already on canvas (-1 = none) — keeps
  // idle scroll events inside a station from repainting the same frame.
  const arrivalDrawnRef   = useRef(-1);

  useEffect(() => {
    // Re-created when the backing store changes size (e.g. the tier settles),
    // which clears the canvas — the current station must be painted again.
    arrivalDrawnRef.current = -1;

    // Frames keep landing while the loop is parked (station at rest): the
    // scheduler asks for the budget pass itself when memory goes over.
    frameScheduler.onOverBudget = () => enforceBudget(activeSegIdxRef.current);

    // Context cached for this effect's lifetime (the canvas element is stable;
    // a resize of the backing store keeps the same context).
    let ctx: CanvasRenderingContext2D | null = null;
    let lastRunAt = -Infinity;

    const driver = () => {
      lastRunAt = performance.now();
      ctx ??= canvasRef.current?.getContext('2d') ?? null;
      if (!ctx) { rafIdRef.current = requestAnimationFrame(driver); return; }

      const state = targetStateRef.current;
      let keepGoing = false;

      if (state.playState === 'playing') {
        arrivalDrawnRef.current = -1;
        const trans = TRANSITIONS[state.transitionIdx];
        if (trans) {
          const segIdx    = SEGMENTS.indexOf(trans);
          const targetLp  = state.direction === 1 ? state.progress : 1 - state.progress;

          if (activeTransIdRef.current !== trans.id) {
            // Entering a new transition — snap (no cross-segment lerp) and
            // release anything outside the new window. Forget the last
            // drawn index: the canvas has shown other content since, so the
            // no-op guard must not skip the first paint.
            activeTransIdRef.current = trans.id;
            activeSegIdxRef.current  = segIdx;
            displayLpRef.current     = targetLp;
            movingBackRef.current    = false;
            lastTargetLpRef.current  = targetLp;
            lastFrameRef.current.delete(trans.id);
            releaseOutsideWindow(segIdx);
          } else {
            if (targetLp !== lastTargetLpRef.current) {
              movingBackRef.current   = targetLp < lastTargetLpRef.current;
              lastTargetLpRef.current = targetLp;
            }
            displayLpRef.current += (targetLp - displayLpRef.current) * LERP_ALPHA;
          }

          const lp = displayLpRef.current;
          let settled = true;

          if (trans.mode === 'stills' || trans.frameCount === 0) {
            ctx.clearRect(0, 0, W, H);
            drawTransitionStills(ctx, trans.startImg, trans.endImg, lp);
          } else {
            // Frames: do NOT pre-clear — keep last valid frame while loading
            settled = drawTransitionFrames(ctx, trans, lp, segIdx);
          }

          // Checked every tick, not just on entry: decoded bytes trickle in
          // asynchronously as fetches resolve, so the moment a loader
          // actually crosses the budget can land well after it was admitted.
          enforceBudget(segIdx);

          keepGoing = !settled || Math.abs(targetLp - displayLpRef.current) > LERP_EPSILON;
        }
      } else {
        // idle — every station paints its own resting frame explicitly;
        // never rely on whatever the previous transition left on canvas.
        activeTransIdRef.current = null;
        // Resting at station N: the transition leaving it is the one the
        // visitor scrolls into next — it becomes the active scene (loads
        // first, protected from the budget pass); the one that brought us here
        // is already painted and is what the budget pass sacrifices first.
        const upcoming = TRANSITIONS[state.station];
        if (upcoming && !prefersReducedMotionRef.current) {
          activeSegIdxRef.current = SEGMENTS.indexOf(upcoming);
          startLoader(upcoming);
          frameScheduler.setActive(loadersRef.current.get(upcoming.id) ?? null);
          for (let k = 1; k <= LOOKAHEAD; k++) {
            const after = TRANSITIONS[state.station + k];
            if (after) startLoader(after);
          }
        }
        enforceBudget(activeSegIdxRef.current);
        if (state.station === 0) {
          const t0       = TRANSITIONS[0];
          const startSrc = t0 ? effectiveStartImg(t0, tier) : undefined;
          const img      = startSrc ? imgsRef.current.get(startSrc) : undefined;
          if (img?.complete) {
            if (img.naturalWidth > 0) {
              ctx.clearRect(0, 0, W, H);
              ctx.drawImage(img, 0, 0, W, H); // raw — matches FrameLoader bitmap render
            }
          } else if (img) {
            keepGoing = true; // still loading — retry next frame (bounded by load/error)
          }
        } else if (arrivalDrawnRef.current !== state.station) {
          if (drawArrival(ctx, state.station)) arrivalDrawnRef.current = state.station;
          else keepGoing = true; // still image not loaded yet — retry next frame
        }
      }

      if (keepGoing) {
        rafIdRef.current = requestAnimationFrame(driver);
      } else {
        loopRunningRef.current = false;
        rafIdRef.current = null;
      }
    };

    // Called by the SceneSnap callback, which fires inside ScrollEngine's rAF.
    // Draw right there instead of waiting for the next frame: otherwise the
    // overlays (updated by the same emit) and the canvas land one frame
    // apart. Any rAF already pending is replaced, so the lerp advances once
    // per frame. Two kicks within the same frame (<2 ms) just leave the
    // pending rAF to pick up the new target.
    ensureLoopRunningRef.current = () => {
      if (performance.now() - lastRunAt < 2) {
        if (!loopRunningRef.current) {
          loopRunningRef.current = true;
          rafIdRef.current = requestAnimationFrame(driver);
        }
        return;
      }
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      loopRunningRef.current = true;
      driver();
    };

    // Draw the initial state immediately (mirrors the old register-fires-
    // synchronously-on-subscribe behavior) instead of waiting a frame.
    ensureLoopRunningRef.current();

    return () => {
      frameScheduler.onOverBudget = undefined;
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      loopRunningRef.current = false;
    };
  }, [drawTransitionStills, drawTransitionFrames, drawArrival, releaseOutsideWindow, enforceBudget, startLoader, tier, W, H]);

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
