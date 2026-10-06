// Central config: stations + transitions.
// To swap a transition from stills to real frames:
//   1. Change mode: 'frames'
//   2. Set framesDir: '/frames/v1/desktop/t1'  (or /frames/v1/mobile/t1 for mobile)
//   3. Set frameCount: <actual frame count>
//   No other code changes needed.

export type Easing = 'linear' | 'smoothstep';

export interface Station {
  type: 'station';
  id: string;
  frameImg: string;
  align: 'center' | 'right';
  scrollVh: number;
  dwellMs?: number;
}

export interface Transition {
  type: 'transition';
  id: string;
  mode: 'stills' | 'frames';
  startImg: string;
  endImg: string;
  framesDir?: string;        // desktop frames dir
  frameCount: number;        // 0 = placeholder; set actual count when frames are ready
  framesDirMobile?: string;  // mobile frames dir (480×854)
  frameCountMobile?: number; // actual mobile frame count
  startImgMobile?: string;   // mobile first-frame fallback shown before loader starts
  endImgMobile?: string;     // mobile last frame — drawn when resting at the next station
  framesDirTablet?: string;  // tablet frames dir (960×540, see useFrameTier)
  frameCountTablet?: number;
  startImgTablet?: string;
  endImgTablet?: string;
  durationMs?: number;       // override DURATION_FRAMES for this transition
  easing: Easing;
  scrollVh: number;
}

export type Segment = Station | Transition;

// Frame sequence tiers — chosen per visitor in hooks/useFrameTier.ts.
export type FrameTier = 'desktop' | 'tablet' | 'mobile';

export interface TierAssets {
  framesDir: string;
  frameCount: number;
  startImg: string;
  endImg: string;
}

/** A transition's frames/stills for one tier (falls back to desktop fields). */
export function tierAssets(t: Transition, tier: FrameTier): TierAssets {
  if (tier === 'mobile' && t.framesDirMobile) {
    return {
      framesDir: t.framesDirMobile,
      frameCount: t.frameCountMobile ?? t.frameCount,
      startImg: t.startImgMobile ?? t.startImg,
      endImg: t.endImgMobile ?? t.endImg,
    };
  }
  if (tier === 'tablet' && t.framesDirTablet) {
    return {
      framesDir: t.framesDirTablet,
      frameCount: t.frameCountTablet ?? t.frameCount,
      startImg: t.startImgTablet ?? t.startImg,
      endImg: t.endImgTablet ?? t.endImg,
    };
  }
  return { framesDir: t.framesDir ?? '', frameCount: t.frameCount, startImg: t.startImg, endImg: t.endImg };
}

// endImg / endImgMobile MUST be the transition's real last frame: the Canvas
// draws it when resting at the following station, and the next transition's
// first frame continues seamlessly from it.
export const SEGMENTS: Segment[] = [
  {
    type: 'transition',
    id: 't1',
    mode: 'frames',
    startImg: '/frames/v1/desktop/escena-1/frame_0001.webp',
    endImg: '/frames/v1/desktop/escena-1/frame_0130.webp',
    framesDir: '/frames/v1/desktop/escena-1',
    frameCount: 130,
    framesDirMobile: '/frames/v1/mobile/escena-1',
    frameCountMobile: 130,
    startImgMobile: '/frames/v1/mobile/escena-1/frame_0001.webp',
    endImgMobile: '/frames/v1/mobile/escena-1/frame_0130.webp',
    framesDirTablet: '/frames/v1/tablet/escena-1',
    frameCountTablet: 130,
    startImgTablet: '/frames/v1/tablet/escena-1/frame_0001.webp',
    endImgTablet: '/frames/v1/tablet/escena-1/frame_0130.webp',
    easing: 'linear',
    scrollVh: 300,
  },
  {
    type: 'station',
    id: 's2',
    // Last frame of t1 — matches what canvas shows when idle at this station.
    frameImg: '/frames/v1/desktop/escena-1/frame_0130.webp',
    align: 'center',
    scrollVh: 80,
  },
  {
    type: 'transition',
    id: 't2',
    mode: 'frames',
    startImg: '/frames/v1/desktop/escena-2/frame_0001.webp',
    endImg: '/frames/v1/desktop/escena-2/frame_0130.webp',
    framesDir: '/frames/v1/desktop/escena-2',
    frameCount: 130,
    framesDirMobile: '/frames/v1/mobile/escena-2',
    frameCountMobile: 130,
    startImgMobile: '/frames/v1/mobile/escena-2/frame_0001.webp',
    endImgMobile: '/frames/v1/mobile/escena-2/frame_0130.webp',
    framesDirTablet: '/frames/v1/tablet/escena-2',
    frameCountTablet: 130,
    startImgTablet: '/frames/v1/tablet/escena-2/frame_0001.webp',
    endImgTablet: '/frames/v1/tablet/escena-2/frame_0130.webp',
    durationMs: 6500,
    easing: 'linear',
    scrollVh: 300,
  },
  {
    type: 'station',
    id: 's3',
    // Last frame of t2.
    frameImg: '/frames/v1/desktop/escena-2/frame_0130.webp',
    align: 'right',
    scrollVh: 80,
  },
  {
    type: 'transition',
    id: 't3',
    mode: 'frames',
    startImg: '/frames/v1/desktop/escena-3/frame_0001.webp',
    endImg: '/frames/v1/desktop/escena-3/frame_0130.webp',
    framesDir: '/frames/v1/desktop/escena-3',
    frameCount: 130,
    framesDirMobile: '/frames/v1/mobile/escena-3',
    frameCountMobile: 130,
    startImgMobile: '/frames/v1/mobile/escena-3/frame_0001.webp',
    endImgMobile: '/frames/v1/mobile/escena-3/frame_0130.webp',
    framesDirTablet: '/frames/v1/tablet/escena-3',
    frameCountTablet: 130,
    startImgTablet: '/frames/v1/tablet/escena-3/frame_0001.webp',
    endImgTablet: '/frames/v1/tablet/escena-3/frame_0130.webp',
    durationMs: 9500,
    easing: 'linear',
    scrollVh: 300,
  },
  {
    type: 'station',
    id: 's4',
    frameImg: '/frames/v1/desktop/escena-3/frame_0130.webp',
    align: 'center',
    scrollVh: 160,
    dwellMs: 1800,
  },
];

// Ordered station IDs (for nav dots) — s1 listed explicitly because it has
// no station segment; its dot stays active during the t1 frame transition.
export const STATION_IDS = ['s1', 's2', 's3', 's4'] as const;

// Total hero height in vh units (5×80 + 4×50 = 600)
export const HERO_VH = SEGMENTS.reduce((acc, s) => acc + s.scrollVh, 0);

export const STATION_NAMES: Record<string, string> = {
  s1: 'El Umbral',
  s2: 'Los Principios',
  s3: 'La Memoria',
  s4: 'La Puerta',
};
