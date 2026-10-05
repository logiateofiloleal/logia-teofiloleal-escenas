import { tierAssets, type Transition, type FrameTier } from '@/config/segments';
import { scheduleIdle } from '@/lib/scheduleIdle';

// Loads a transition's frame sequence as ImageBitmaps (decoded off-main-thread).
// Memory management: call release() when the segment is far behind (RELEASE_LAG).

// Safari <15.4 doesn't have createImageBitmap; fall back to HTMLImageElement.
const HAS_CREATE_IMAGE_BITMAP = typeof createImageBitmap === 'function';

// Both ImageBitmap and HTMLImageElement satisfy CanvasImageSource.
type FrameSource = ImageBitmap | HTMLImageElement;

async function decodeFrame(blob: Blob): Promise<FrameSource> {
  if (HAS_CREATE_IMAGE_BITMAP) {
    return createImageBitmap(blob);
  }
  const url = URL.createObjectURL(blob);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load failed')); };
    img.src = url;
  });
}

function closeFrame(frame: FrameSource): void {
  if ('close' in frame) (frame as ImageBitmap).close();
  // HTMLImageElement has no explicit close; GC handles it.
}

// Closing a whole transition (130 decoded frames) in one go takes 50–120 ms
// on the main thread (measured), and release() runs inside Canvas's draw
// loop — a visible stall on every transition change. Closing a few frames
// per idle slot keeps each slice to a few ms; the timeout keeps it moving
// while the visitor scrolls non-stop.
const CLOSE_CHUNK = 8;
const CLOSE_TIMEOUT_MS = 250;

function closeGradually(frames: FrameSource[]): void {
  const step = () => {
    for (let n = 0; n < CLOSE_CHUNK && frames.length > 0; n++) closeFrame(frames.pop()!);
    if (frames.length > 0) scheduleIdle(step, CLOSE_TIMEOUT_MS);
  };
  scheduleIdle(step, CLOSE_TIMEOUT_MS);
}

// ── Module-level memory accounting ──────────────────────────────────────
// Every decoded frame (ImageBitmap or HTMLImageElement) held by any live
// FrameLoader counts here, so Canvas.tsx can enforce a hard memory budget
// across all loaders instead of guessing. Cleared on close/release.
let liveBytes = 0;
let liveBitmaps = 0;

export function getLiveBytes(): number {
  return liveBytes;
}

export function getLiveBitmaps(): number {
  return liveBitmaps;
}

// ── Coarse-to-fine load order ───────────────────────────────────────────
// Frames are fetched in passes — every 8th frame, then every 4th, 2nd, and
// finally the rest — instead of 0 → N in order. After the first pass the
// canvas always has a frame within 4 of any position, so a scrub that outruns
// the network degrades to "slightly coarser" rather than "frozen on a frame
// 100 away". See FrameScheduler below for how passes of different scenes
// share the connection.
const PASS_STRIDES = [8, 4, 2, 1] as const;
const LAST_LEVEL = PASS_STRIDES.length - 1;
const URGENT_MAX = 4;

const PENDING = 0;
const INFLIGHT = 1;
const SETTLED = 2;
const DECODING = 3; // downloaded, createImageBitmap still running

// Frames each transition had decoded before its loader was released (budget or
// window pass). A frame missing from a fresh loader but present here is waiting
// for a re-decode, not for the network — see FrameLoader.causeOf.
const decodedBefore = new Map<string, Uint8Array>();

export type StandInCause = 'a' | 'b' | 'c';

export class FrameLoader {
  private frames: (FrameSource | null)[] = [];
  private state: Uint8Array;
  private levels: number[][];
  private cursors: number[];
  private urgent: number[] = [];
  private lastDrawnIndex = -1;
  private pending: number;

  public cancelled = false;
  /** Called with the frame's URL once it has settled (decoded or failed). */
  public onFrameDone?: (src: string) => void;

  readonly id: string;
  private readonly framesDir: string;
  private readonly frameCount: number;
  // Bytes per decoded frame (W*H*4), used for the global memory accounting above.
  readonly frameBytes: number;

  constructor(transition: Transition, tier: FrameTier, frameBytes: number) {
    const assets    = tierAssets(transition, tier);
    this.id         = transition.id;
    this.framesDir  = assets.framesDir;
    this.frameCount = assets.frameCount;
    this.frameBytes = frameBytes;
    this.state      = new Uint8Array(this.frameCount);
    this.pending    = this.framesDir ? this.frameCount : 0;
    const seen = new Set<number>();
    this.levels = PASS_STRIDES.map((stride, lvl) => {
      const idx: number[] = [];
      for (let i = 0; i < this.frameCount; i += stride) if (!seen.has(i)) { seen.add(i); idx.push(i); }
      // The last frame is where the next station rests — part of the first pass.
      if (lvl === 0 && this.frameCount > 0 && !seen.has(this.frameCount - 1)) {
        seen.add(this.frameCount - 1);
        idx.push(this.frameCount - 1);
      }
      return idx;
    });
    this.cursors = this.levels.map(() => 0);
  }

  getFrame(index: number): FrameSource | null {
    return this.frames[index] ?? null;
  }

  getLastValid(): FrameSource | null {
    for (let i = this.lastDrawnIndex; i >= 0; i--) {
      if (this.frames[i]) return this.frames[i]!;
    }
    return null;
  }

  setLastDrawn(index: number) {
    this.lastDrawnIndex = index;
  }

  getLastDrawnIndex(): number {
    return this.lastDrawnIndex;
  }

  /** True while frames are still waiting to be fetched or decoded (more may arrive). */
  get isLoading(): boolean {
    return this.pending > 0 && !this.cancelled;
  }

  /** Effective frame count (mobile or desktop, whichever this loader was built for). */
  get count(): number {
    return this.frameCount;
  }

  /** URLs of the first (coarsest) pass — what the Preloader waits for. */
  coarseSrcs(): string[] {
    return this.levels[0].map(i => this.frameSrc(i));
  }

  /**
   * Index of the decoded frame closest to targetIndex in either direction
   * (ties go to the earlier frame), or -1 if none is decoded yet.
   */
  nearestIndex(targetIndex: number): number {
    for (let d = 0; d < this.frameCount; d++) {
      const lo = targetIndex - d;
      if (lo >= 0 && lo < this.frameCount && this.frames[lo]) return lo;
      const hi = targetIndex + d;
      if (d > 0 && hi >= 0 && hi < this.frameCount && this.frames[hi]) return hi;
    }
    return -1;
  }

  /** Returns the decoded frame closest to targetIndex. */
  nearestFrame(targetIndex: number): FrameSource | null {
    const i = this.nearestIndex(targetIndex);
    return i < 0 ? null : this.frames[i];
  }

  /**
   * Why `index` isn't decodable right now (measurement only, see perfProbe):
   * a = not downloaded yet, b = downloaded but still decoding, c = was decoded
   * before this loader was released and is waiting to be fetched/decoded again.
   */
  causeOf(index: number): StandInCause {
    if (decodedBefore.get(this.id)?.[index]) return 'c';
    return this.state[index] === DECODING ? 'b' : 'a';
  }

  /** URL of frame `index` (0-based) — also the key passed to onFrameDone. */
  frameSrc(index: number): string {
    return `${this.framesDir}/frame_${String(index + 1).padStart(4, '0')}.webp`;
  }

  /**
   * Asks for this exact frame to jump the queue — used while the canvas is
   * showing a stand-in for it. Only the newest few requests are kept: the
   * visitor has already scrolled past the older ones.
   */
  want(index: number): void {
    if (this.cancelled || index < 0 || index >= this.frameCount) return;
    if (this.state[index] !== PENDING || this.urgent.includes(index)) return;
    this.urgent.push(index);
    if (this.urgent.length > URGENT_MAX) this.urgent.shift();
    frameScheduler.pump();
  }

  /** Next frame to fetch and its pass (-1 = urgent), without claiming it. */
  peek(): { index: number; level: number } | null {
    if (this.cancelled || this.pending === 0) return null;
    while (this.urgent.length > 0) {
      const index = this.urgent[this.urgent.length - 1];
      if (this.state[index] === PENDING) return { index, level: -1 };
      this.urgent.pop();
    }
    for (let lvl = 0; lvl <= LAST_LEVEL; lvl++) {
      const list = this.levels[lvl];
      let c = this.cursors[lvl];
      while (c < list.length && this.state[list[c]] !== PENDING) c++;
      this.cursors[lvl] = c;
      if (c < list.length) return { index: list[c], level: lvl };
    }
    return null;
  }

  /** Fetches, decodes and stores one frame (claimed via peek()). */
  async fetchFrame(index: number): Promise<void> {
    if (this.state[index] !== PENDING) return;
    this.state[index] = INFLIGHT;
    const src = this.frameSrc(index);
    try {
      const res = await fetch(src);
      if (this.cancelled) return;
      const blob = await res.blob();
      if (this.cancelled) return;
      this.state[index] = DECODING;
      const frame = await decodeFrame(blob);
      if (!this.cancelled) {
        this.frames[index] = frame;
        liveBytes += this.frameBytes;
        liveBitmaps++;
      } else {
        closeFrame(frame);
        return;
      }
    } catch {
      this.frames[index] = null;
    }
    this.state[index] = SETTLED;
    this.pending--;
    this.onFrameDone?.(src);
  }

  /**
   * Drops this loader's frames. They stop counting toward the memory budget
   * right away (so Canvas's budget pass never over-releases), and are closed
   * a few at a time off the draw loop — see closeGradually.
   */
  release(): void {
    this.cancelled = true;
    frameScheduler.remove(this);
    const decoded = this.frames.filter((f): f is FrameSource => f != null);
    if (decoded.length > 0) {
      const seen = decodedBefore.get(this.id) ?? new Uint8Array(this.frameCount);
      this.frames.forEach((f, i) => { if (f) seen[i] = 1; });
      decodedBefore.set(this.id, seen);
    }
    liveBytes -= decoded.length * this.frameBytes;
    liveBitmaps -= decoded.length;
    this.frames = [];
    this.urgent = [];
    this.lastDrawnIndex = -1;
    if (decoded.length > 0) closeGradually(decoded);
  }
}

// ── Scheduler: one connection budget shared by every loader ────────────
// Picks the next frame across all live loaders. Cost = pass number, plus a
// penalty when the loader isn't the active scene, so the order is:
//   active 1/8 → every scene's 1/8 → active 1/4 → next 1/4 → active 1/2 → …
// i.e. every scene gets its coarse pass early (no waiting for lp > 0.6), and
// finer passes go to the active scene first. A frame the canvas is waiting
// for (urgent) always goes first.
//
// Non-active scenes are also bounded by the memory budget (a frame is only
// started if it still fits) and, for their fine passes, paused while the
// visitor is actively scrolling.
const NEXT_PENALTY = 1.5;
const COARSE_PENALTY = 0.5;
const SCROLL_IDLE_MS = 150;
const FINE_LEVEL = 2;

class FrameScheduler {
  private loaders = new Set<FrameLoader>();
  private active: FrameLoader | null = null;
  private inflight = 0;
  private reserved = 0;           // bytes of fetches in flight (not yet in liveBytes)
  private lastScrollAt = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private concurrency = 6;
  private budget = Infinity;
  /**
   * Set by Canvas: frees whatever is furthest from the active scene. Called
   * whenever decoded memory is over budget after a frame lands — the draw loop
   * parks while the scene is at rest, so it can't be relied on to notice.
   */
  onOverBudget?: () => void;
  /**
   * Set by Canvas: false while the Preloader is still waiting. Until it opens,
   * only the active scene's coarse pass is fetched, so the stills and that first
   * pass are not queued behind a connection saturated by everything else.
   */
  gateOpen?: () => boolean;

  /**
   * Concurrency follows the protocol: HTTP/2+ multiplexes many requests on one
   * connection, and each frame is ~50 KB, so with ~40-700 ms of latency per
   * request the connection sits idle unless many are in flight. HTTP/1.1 is
   * capped at ~6 connections per host by the browser anyway. Phones (and iOS
   * Safari in particular) decode on less memory/CPU, so they get fewer.
   */
  configure(tier: FrameTier, budgetBytes: number): void {
    this.budget = budgetBytes;
    let proto = '';
    try {
      proto = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
        ?.nextHopProtocol ?? '';
    } catch { /* keep default */ }
    const multiplexed = proto === 'h2' || proto === 'h3';
    const phone = tier !== 'desktop';
    let n = multiplexed ? (phone ? 6 : 12) : (phone ? 4 : 6);
    if (typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
      n = Math.min(n, 4);
    }
    this.concurrency = n;
  }

  add(loader: FrameLoader): void {
    this.loaders.add(loader);
    this.pump();
  }

  remove(loader: FrameLoader): void {
    this.loaders.delete(loader);
    if (this.active === loader) this.active = null;
  }

  setActive(loader: FrameLoader | null): void {
    if (this.active === loader) return;
    this.active = loader;
    this.pump();
  }

  /** Called on every scroll update; fine passes of other scenes wait for rest. */
  noteScroll(): void {
    this.lastScrollAt = performance.now();
    if (this.resumeTimer != null) clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => { this.resumeTimer = null; this.pump(); }, SCROLL_IDLE_MS + 10);
  }

  pump(): void {
    while (this.inflight < this.concurrency) {
      const pick = this.pick();
      if (!pick) return;
      const { loader, index } = pick;
      this.inflight++;
      this.reserved += loader.frameBytes;
      loader.fetchFrame(index).finally(() => {
        this.inflight--;
        this.reserved -= loader.frameBytes;
        if (liveBytes > this.budget) this.onOverBudget?.();
        this.pump();
      });
    }
  }

  private pick(): { loader: FrameLoader; index: number } | null {
    const scrolling = performance.now() - this.lastScrollAt < SCROLL_IDLE_MS;
    const held = this.gateOpen ? !this.gateOpen() : false;
    let best: { loader: FrameLoader; index: number } | null = null;
    let bestCost = Infinity;
    for (const loader of this.loaders) {
      const job = loader.peek();
      if (!job) continue;
      const isActive = loader === this.active;
      if (held && !(isActive && job.level <= 0)) continue;
      let cost = job.level;
      if (!isActive) {
        if (job.level >= FINE_LEVEL && scrolling) continue;
        if (liveBytes + this.reserved + loader.frameBytes > this.budget) continue;
        // Every scene's coarse pass (1/8, ~17 frames) is cheap and is what keeps
        // a fast scrub within 4 frames of the exact one, so it only waits for
        // the active scene's own coarse pass; finer passes queue behind the
        // active scene's.
        cost += job.level === 0 ? COARSE_PENALTY : NEXT_PENALTY;
      }
      if (cost < bestCost) { bestCost = cost; best = { loader, index: job.index }; }
    }
    return best;
  }
}

export const frameScheduler = new FrameScheduler();
