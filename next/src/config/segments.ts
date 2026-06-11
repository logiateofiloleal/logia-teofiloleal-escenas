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
}

export interface Transition {
  type: 'transition';
  id: string;
  mode: 'stills' | 'frames';
  startImg: string;
  endImg: string;
  framesDir?: string;   // e.g. '/frames/desktop/t1' — set when mode:'frames'
  frameCount: number;   // 0 = placeholder; set actual count when frames are ready
  easing: Easing;
  scrollVh: number;
}

export type Segment = Station | Transition;

const D = '/frames/desktop'; // desktop frame base path

export const SEGMENTS: Segment[] = [
  {
    type: 'station',
    id: 's1',
    frameImg: `${D}/frame-1.webp`,
    align: 'center',
    scrollVh: 80,
  },
  {
    type: 'transition',
    id: 't1',
    mode: 'stills',
    startImg: `${D}/frame-1.webp`,
    endImg: `${D}/frame-2.webp`,
    frameCount: 0, // placeholder — replace with actual count when Higgsfield video is ready
    easing: 'smoothstep',
    scrollVh: 50,
  },
  {
    type: 'station',
    id: 's2',
    frameImg: `${D}/frame-2.webp`,
    align: 'center',
    scrollVh: 80,
  },
  {
    type: 'transition',
    id: 't2',
    mode: 'stills',
    startImg: `${D}/frame-2.webp`,
    endImg: `${D}/frame-3.webp`,
    frameCount: 0,
    easing: 'smoothstep',
    scrollVh: 50,
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
    mode: 'stills',
    startImg: `${D}/frame-3.webp`,
    endImg: `${D}/frame-4.webp`,
    frameCount: 0,
    easing: 'smoothstep',
    scrollVh: 50,
  },
  {
    type: 'station',
    id: 's4',
    frameImg: `${D}/frame-4.webp`,
    align: 'center',
    scrollVh: 80,
  },
  {
    type: 'transition',
    id: 't4',
    mode: 'stills',
    startImg: `${D}/frame-4.webp`,
    endImg: `${D}/frame-5.webp`,
    frameCount: 0,
    easing: 'smoothstep',
    scrollVh: 50,
  },
  {
    type: 'station',
    id: 's5',
    frameImg: `${D}/frame-5.webp`,
    align: 'center',
    scrollVh: 80,
  },
];

// Ordered station IDs (for nav dots)
export const STATION_IDS = SEGMENTS
  .filter((s): s is Station => s.type === 'station')
  .map(s => s.id);

// Total hero height in vh units (5×80 + 4×50 = 600)
export const HERO_VH = SEGMENTS.reduce((acc, s) => acc + s.scrollVh, 0);

export const STATION_NAMES: Record<string, string> = {
  s1: 'El Umbral',
  s2: 'Los Principios',
  s3: 'La Memoria',
  s4: 'La Puerta',
  s5: 'Acceso Interno',
};
