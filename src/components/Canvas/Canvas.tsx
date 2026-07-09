'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSceneSnap, type SceneState } from '@/context/SceneSnap';
import { SEGMENTS, type Transition, type Station } from '@/config/segments';
import { FrameLoader } from '@/lib/frameLoader';
import { resetPreloadGate, reportPreloadItemDone } from '@/lib/preloadGate';
import styles from './Canvas.module.css';

// Backing store dimensions MUST match frame dimensions exactly.
// Mismatch forces per-paint GPU rescaling.
const DESKTOP_W = 1280;
const DESKTOP_H = 720;
const MOBILE_W  = 480;
const MOBILE_H  = 854;

// Memory retention: keep active + N previous transition loaders
const RELEASE_LAG_DESKTOP = 3;
const RELEASE_LAG_MOBILE  = 2;

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

export default function Canvas() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const isMobile   = useIsMobile();
  const { register, getState } = useSceneSnap();

  const W          = isMobile ? MOBILE_W  : DESKTOP_W;
  const H          = isMobile ? MOBILE_H  : DESKTOP_H;
  const releaseLag = isMobile ? RELEASE_LAG_MOBILE : RELEASE_LAG_DESKTOP;

  // Preloaded stills — HTMLImageElement (sync drawImage once .complete)
  const imgsRef    = useRef<Map<string, HTMLImageElement>>(new Map());

  // FrameLoader per transition id (lazy, only for mode:'frames')
  const loadersRef   = useRef<Map<string, FrameLoader>>(new Map());
  const lastFrameRef = useRef<Map<string, number>>(new Map()); // guard redundant draws

  // ── Backing store ────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width  = W;
    c.height = H;
  }, [W, H]);

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

    const mobileNow = typeof window !== 'undefined' && window.innerWidth < 768;
    const t0FrameCount = t0 ? effectiveFrameCount(t0, mobileNow) : 0;
    resetPreloadGate(srcs.size + t0FrameCount);

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

    if (t0 && t0.mode === 'frames' && t0FrameCount > 0 && !loadersRef.current.has(t0.id)) {
      const loader = new FrameLoader(t0, mobileNow);
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

  const drawTransitionFrames = useCallback(
    (ctx: CanvasRenderingContext2D, transition: Transition, lp: number, segIdx: number) => {
      const fc = effectiveFrameCount(transition, isMobile);
      if (fc === 0) {
        drawTransitionStills(ctx, transition.startImg, transition.endImg, lp);
        return;
      }

      // Lazy init loader
      let loader = loadersRef.current.get(transition.id);
      if (!loader) {
        loader = new FrameLoader(transition, isMobile);
        loadersRef.current.set(transition.id, loader);
        loader.load();
      }

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

      // Preload next transition at 60%
      if (lp > 0.6 && segIdx + 1 < SEGMENTS.length) {
        const next = SEGMENTS[segIdx + 1];
        if (next.type === 'transition' && next.mode === 'frames' && effectiveFrameCount(next, isMobile) > 0) {
          if (!loadersRef.current.has(next.id)) {
            const nl = new FrameLoader(next, isMobile);
            loadersRef.current.set(next.id, nl);
            nl.load();
          }
        }
      }

      // Release old loaders (memory management)
      const releaseAt = segIdx - releaseLag * 2;
      if (releaseAt >= 0) {
        const old = SEGMENTS[releaseAt];
        if (old.type === 'transition') {
          const ol = loadersRef.current.get(old.id);
          if (ol) { ol.release(); loadersRef.current.delete(old.id); lastFrameRef.current.delete(old.id); }
        }
      }
    },
    [drawTransitionStills, isMobile, W, H, releaseLag],
  );

  // ── Register with SceneSnap (direct RAF progress — no scroll-event chain) ──
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    return register((state: SceneState) => {
      const ctx = c.getContext('2d');
      if (!ctx) return;

      if (state.playState === 'playing') {
        const trans = TRANSITIONS[state.transitionIdx];
        if (!trans) return;

        // Forward: progress 0→1 = lp 0→1. Reverse: lp 1→0.
        const lp     = state.direction === 1 ? state.progress : 1 - state.progress;
        const segIdx = SEGMENTS.indexOf(trans);

        if (trans.mode === 'stills' || trans.frameCount === 0) {
          ctx.clearRect(0, 0, W, H);
          drawTransitionStills(ctx, trans.startImg, trans.endImg, lp);
        } else {
          // Frames: do NOT pre-clear — keep last valid frame while loading
          drawTransitionFrames(ctx, trans, lp, segIdx);
        }
      } else {
        // idle — only station 0 needs an explicit draw (initial mount).
        // Stations 1-4: keep whatever the transition left on canvas —
        // the last painted frame IS the correct still, no visual jump.
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
    });
  }, [register, drawImg, drawStation, drawTransitionStills, drawTransitionFrames, W, H]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
    />
  );
}
