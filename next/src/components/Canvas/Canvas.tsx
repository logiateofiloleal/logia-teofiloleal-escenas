'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useScrollEngine, type ScrollState } from '@/context/ScrollEngine';
import { SEGMENTS, type Transition } from '@/config/segments';
import { FrameLoader } from '@/lib/frameLoader';
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

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile  = useIsMobile();
  const { register } = useScrollEngine();

  const W = isMobile ? MOBILE_W  : DESKTOP_W;
  const H = isMobile ? MOBILE_H  : DESKTOP_H;
  const releaseLag = isMobile ? RELEASE_LAG_MOBILE : RELEASE_LAG_DESKTOP;

  // Preloaded stills — HTMLImageElement (sync drawImage once .complete)
  const imgsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // FrameLoader per transition id (lazy, only for mode:'frames')
  const loadersRef    = useRef<Map<string, FrameLoader>>(new Map());
  const lastFrameRef  = useRef<Map<string, number>>(new Map()); // guard against redundant draws

  // ── Backing store ────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width  = W;
    c.height = H;
  }, [W, H]);

  // ── Preload all stills ───────────────────────────────────
  useEffect(() => {
    const srcs = new Set<string>();
    for (const seg of SEGMENTS) {
      if (seg.type === 'station') srcs.add(seg.frameImg);
      else { srcs.add(seg.startImg); srcs.add(seg.endImg); }
    }
    srcs.forEach(src => {
      if (imgsRef.current.has(src)) return;
      const img = new Image();
      img.src = src;
      imgsRef.current.set(src, img);
    });
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
        // TODO: replace with native 9:16 assets from /frames/mobile/<id>/ when available.
        const drawH = Math.round(W / (16 / 9));
        const offsetY = Math.round((H - drawH) / 2);
        ctx.drawImage(img, 0, offsetY, W, drawH);
        ctx.restore();

        // Black bars
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

      // Frame A — end state (scale 1.010, brightness 0.92)
      drawImg(ctx, imgA, 1.010, 'brightness(0.92) contrast(1.06) saturate(1.08)');

      // Frame B fading in with smoothStep
      if (imgB?.complete && imgB.naturalWidth > 0) {
        const t          = ss(0.1, 0.9, lp);
        const brightness = 0.82 + t * 0.10;
        const saturate   = 1.04 + t * 0.04;
        const scaleB     = 1.045 - t * 0.010;

        // Set globalAlpha BEFORE calling drawImg — drawImg's internal save/restore
        // inherits the current globalAlpha and cleans up correctly.
        ctx.save();
        ctx.globalAlpha = t;
        drawImg(ctx, imgB, scaleB, `brightness(${brightness}) contrast(1.06) saturate(${saturate})`);
        ctx.restore(); // restores globalAlpha to 1
      }
    },
    [drawImg],
  );

  const drawTransitionFrames = useCallback(
    (ctx: CanvasRenderingContext2D, transition: Transition, lp: number, segIdx: number) => {
      if (transition.frameCount === 0) {
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

      const targetIdx = Math.floor(lp * (transition.frameCount - 1));
      const lastDrawn = lastFrameRef.current.get(transition.id) ?? -2;

      if (targetIdx === lastDrawn) return; // no-op guard

      const bitmap = loader.getFrame(targetIdx);
      if (bitmap) {
        ctx.drawImage(bitmap, 0, 0, W, H);
        loader.setLastDrawn(targetIdx);
        lastFrameRef.current.set(transition.id, targetIdx);
      }
      // No else: keep last valid frame on canvas (no clear)

      // Preload next transition at 60%
      if (lp > 0.6 && segIdx + 1 < SEGMENTS.length) {
        const next = SEGMENTS[segIdx + 1];
        if (next.type === 'transition' && next.mode === 'frames' && next.frameCount > 0) {
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

  // ── Register with scroll engine ──────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    return register((state: ScrollState) => {
      const ctx = c.getContext('2d');
      if (!ctx) return;

      const seg = SEGMENTS.find(s => s.id === state.segmentId);
      if (!seg) return;

      if (seg.type === 'station') {
        ctx.clearRect(0, 0, W, H);
        drawStation(ctx, seg.frameImg, state.localProgress);
      } else {
        const segIdx = SEGMENTS.indexOf(seg);
        if (seg.mode === 'stills' || seg.frameCount === 0) {
          // Stills: always have images, safe to clear first
          ctx.clearRect(0, 0, W, H);
          drawTransitionStills(ctx, seg.startImg, seg.endImg, state.localProgress);
        } else {
          // Frames: do NOT pre-clear — drawTransitionFrames keeps last valid
          // frame on canvas when the target index isn't loaded yet
          drawTransitionFrames(ctx, seg, state.localProgress, segIdx);
        }
      }
    });
  }, [register, drawStation, drawTransitionStills, drawTransitionFrames, W, H]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      aria-hidden="true"
    />
  );
}
