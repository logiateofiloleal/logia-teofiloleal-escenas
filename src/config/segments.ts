// Central config: stations + transitions.
// To swap a transition from stills to real frames:
//   1. Change mode: 'frames'
//   2. Set framesDir: '/frames/desktop/t1'  (or frames-mobile for mobile)
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
  durationMs?: number;       // override DURATION_FRAMES for this transition
  easing: Easing;
  scrollVh: number;
}

export type Segment = Station | Transition;

const D = '/frames/desktop'; // desktop frame base path

export const SEGMENTS: Segment[] = [
  {
    type: 'transition',
    id: 't1',
    mode: 'frames',
    startImg: '/frames/escena-1-desktop/frame_0001.webp',
    endImg: `${D}/frame-2.webp`,
    framesDir: '/frames/escena-1-desktop',
    frameCount: 130,
    framesDirMobile: '/frames/mobile/escena-1',
    frameCountMobile: 130,
    startImgMobile: '/frames/mobile/escena-1/frame_0001.webp',
    easing: 'linear',
    scrollVh: 300,
  },
  {
    type: 'station',
    id: 's2',
    // Last frame of t1 — matches what canvas shows when idle at this station.
    frameImg: '/frames/escena-1-desktop/frame_0130.webp',
    align: 'center',
    scrollVh: 80,
  },
  {
    type: 'transition',
    id: 't2',
    mode: 'frames',
    startImg: '/frames/escena-2-desktop/frame_0001.webp',
    endImg: `${D}/frame-3.webp`,
    framesDir: '/frames/escena-2-desktop',
    frameCount: 130,
    framesDirMobile: '/frames/mobile/escena-2',
    frameCountMobile: 130,
    startImgMobile: '/frames/mobile/escena-2/frame_0001.webp',
    durationMs: 6500,
    easing: 'linear',
    scrollVh: 300,
  },
  {
    type: 'station',
    id: 's3',
    frameImg: `${D}/frame-3.webp`,
    align: 'right',
    scrollVh: 80,
  },
  {
    type: 'transition',
    id: 't3',
    mode: 'frames',
    startImg: '/frames/escena-3-desktop/frame_0001.webp',
    endImg: '/frames/escena-3-desktop/frame_0130.webp',
    framesDir: '/frames/escena-3-desktop',
    frameCount: 130,
    framesDirMobile: '/frames/mobile/escena-3',
    frameCountMobile: 130,
    startImgMobile: '/frames/mobile/escena-3/frame_0001.webp',
    durationMs: 9500,
    easing: 'linear',
    scrollVh: 300,
  },
  {
    type: 'station',
    id: 's4',
    frameImg: '/frames/escena-3-desktop/frame_0130.webp',
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
