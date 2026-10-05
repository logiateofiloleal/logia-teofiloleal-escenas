import { tierAssets, type Transition, type FrameTier } from '@/config/segments';
import { FRAME_PACKS, type FramePack } from '@/config/framePacks.generated';
import { scheduleIdle } from '@/lib/scheduleIdle';
import { recordEvent } from '@/lib/perfProbe';

// Loads a transition's frame sequence as ImageBitmaps (decoded off-main-thread).
// Memory management: call release() when the segment is far behind (RELEASE_LAG).
//
// Frames travel in PACKS (scripts/build-frame-packs.mjs): one request carries
// ~16-18 WebP frames concatenated as they are, and the loader cuts them apart
// with blob.slice. 390 requests per visitor — each paying ~0.7 s of latency —
// became 24 + the stills.

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

// ── Decode queue ────────────────────────────────────────────────────────
// A pack lands all at once: 16-18 createImageBitmap calls in the same tick. On
// phones (iOS especially) that is a burst of decode work and memory, so frames
// go through one shared queue with at most DECODE_CONCURRENCY running. The
// frame the canvas is waiting for can jump the queue (FrameLoader.want).
const DECODE_CONCURRENCY = 4;

interface DecodeJob {
  loader: FrameLoader;
  index: number;
  blob: Blob;
  done: () => void;
}

const decodeQueue: DecodeJob[] = [];
let decodeRunning = 0;

function pumpDecode(): void {
  while (decodeRunning < DECODE_CONCURRENCY && decodeQueue.length > 0) {
    const job = decodeQueue.shift()!;
    if (job.loader.cancelled) { job.done(); continue; }
    decodeRunning++;
    job.loader.decodeOne(job.index, job.blob).finally(() => {
      decodeRunning--;
      job.done();
      pumpDecode();
    });
  }
}

function enqueueDecode(loader: FrameLoader, index: number, blob: Blob): Promise<void> {
  return new Promise<void>((resolve) => {
    decodeQueue.push({ loader, index, blob, done: resolve });
    pumpDecode();
  });
}

/** Moves a queued decode to the front (the canvas is showing a stand-in for it). */
function prioritizeDecode(loader: FrameLoader, index: number): void {
  const i = decodeQueue.findIndex(j => j.loader === loader && j.index === index);
  if (i > 0) decodeQueue.unshift(decodeQueue.splice(i, 1)[0]);
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
// Packs are ordered by pass: every 8th frame (level 0), then the rest of every
// 4th (1), 2nd (2), and finally the others (3), instead of 0 → N in order.
// After the first pack the canvas always has a frame within 4 of any
// position, so a scrub that outruns the network degrades to "slightly
// coarser" rather than "frozen on a frame 100 away". See FrameScheduler below
// for how passes of different scenes share the connection.
const URGENT_MAX = 3;
const PACK_RETRIES = 1; // one retry, then the pack's frames are given up (stand-ins cover them)

const PENDING = 0;
const INFLIGHT = 1;  // its pack is downloading
const SETTLED = 2;
const DECODING = 3;  // pack downloaded, createImageBitmap queued or running

// Frames each transition had decoded before its loader was released (budget or
// window pass). A frame missing from a fresh loader but present here is waiting
// for a re-decode, not for the network — see FrameLoader.causeOf.
const decodedBefore = new Map<string, Uint8Array>();

export type StandInCause = 'a' | 'b' | 'c';

/** Measurement only: where the missing frame's pack stands (see perfProbe). */
export interface MissingInfo {
  level: number;
  packState: 'sin pedir' | 'descargando' | 'decodificando' | 'sin pack';
}

export interface PackJob {
  /** Pack number within its loader. */
  index: number;
  level: number;
  /** Decoded size of the frames it will add (frames × frameBytes). */
  bytes: number;
}

export class FrameLoader {
  private frames: (FrameSource | null)[] = [];
  private state: Uint8Array;
  private packs: readonly FramePack[];
  private packOf: Int16Array;       // frame index → pack number (-1 = in no pack)
  private packState: Uint8Array;    // PENDING | INFLIGHT | SETTLED per pack
  private packCursor = 0;
  private urgent: number[] = [];    // pack numbers the canvas is waiting for
  private lastDrawnIndex = -1;
  private pending: number;

  public cancelled = false;
  /** Called with a pack's URL once all its frames have settled (decoded or given up). */
  public onSettled?: (src: string) => void;

  readonly id: string;
  private readonly frameCount: number;
  // Bytes per decoded frame (W*H*4), used for the global memory accounting above.
  readonly frameBytes: number;

  constructor(transition: Transition, tier: FrameTier, frameBytes: number) {
    const assets    = tierAssets(transition, tier);
    this.id         = transition.id;
    this.frameCount = assets.frameCount;
    this.frameBytes = frameBytes;
    this.packs      = FRAME_PACKS[assets.framesDir] ?? [];
    this.state      = new Uint8Array(this.frameCount);
    this.packState  = new Uint8Array(this.packs.length);
    this.packOf     = new Int16Array(this.frameCount).fill(-1);
    this.packs.forEach((p, k) => p.frames.forEach(([i]) => { if (i < this.frameCount) this.packOf[i] = k; }));
    this.pending    = this.packOf.reduce((n, k) => n + (k >= 0 ? 1 : 0), 0);
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

  /** URL of the first (coarsest) pack — what the Preloader waits for. */
  coarseSrcs(): string[] {
    return this.packs.length > 0 ? [this.packs[0].url] : [];
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

  missingInfo(index: number): MissingInfo {
    const k = this.packOf[index];
    if (k < 0) return { level: 3, packState: 'sin pack' };
    const level = this.packs[k].level;
    if (this.packState[k] === PENDING) return { level, packState: 'sin pedir' };
    return { level, packState: this.state[index] === DECODING ? 'decodificando' : 'descargando' };
  }

  /**
   * Asks for this exact frame to jump the queue — used while the canvas is
   * showing a stand-in for it. If its pack hasn't been requested, that pack goes
   * next; if the pack is here but the frame is still waiting to be decoded, the
   * frame goes first. Only the newest few requests are kept: the visitor has
   * already scrolled past the older ones.
   */
  want(index: number): void {
    if (this.cancelled || index < 0 || index >= this.frameCount) return;
    const k = this.packOf[index];
    if (k < 0) return;
    if (this.packState[k] === PENDING) {
      if (this.urgent.includes(k)) return;
      this.urgent.push(k);
      if (this.urgent.length > URGENT_MAX) this.urgent.shift();
      frameScheduler.pump();
    } else if (this.state[index] === DECODING) {
      prioritizeDecode(this, index);
    }
  }

  /** Next pack to fetch and its pass (-1 = urgent), without claiming it. */
  peek(): PackJob | null {
    if (this.cancelled || this.pending === 0) return null;
    while (this.urgent.length > 0) {
      const k = this.urgent[this.urgent.length - 1];
      if (this.packState[k] === PENDING) return this.job(k, -1);
      this.urgent.pop();
    }
    while (this.packCursor < this.packs.length && this.packState[this.packCursor] !== PENDING) this.packCursor++;
    if (this.packCursor < this.packs.length) return this.job(this.packCursor, this.packs[this.packCursor].level);
    return null;
  }

  private job(k: number, level: number): PackJob {
    return { index: k, level, bytes: this.packs[k].frames.length * this.frameBytes };
  }

  /** Downloads one pack (claimed via peek()), then decodes its frames. */
  async fetchPack(k: number): Promise<void> {
    if (this.packState[k] !== PENDING) return;
    this.packState[k] = INFLIGHT;
    const pack = this.packs[k];
    const bytes = pack.frames.length ? pack.frames[pack.frames.length - 1][1] + pack.frames[pack.frames.length - 1][2] : 0;
    recordEvent('pack-start', { id: this.id, pack: k, level: pack.level, bytes });
    for (const [i] of pack.frames) this.state[i] = INFLIGHT;

    let blob: Blob | null = null;
    for (let attempt = 0; attempt <= PACK_RETRIES && !blob && !this.cancelled; attempt++) {
      try {
        const res = await fetch(pack.url);
        if (!res.ok) throw new Error(`pack ${pack.url}: ${res.status}`);
        blob = await res.blob();
      } catch {
        blob = null; // retried once; after that the frames are given up below
      }
    }
    if (this.cancelled) return;

    if (blob) {
      for (const [i] of pack.frames) this.state[i] = DECODING;
      await Promise.all(pack.frames.map(([i, offset, len]) =>
        enqueueDecode(this, i, blob!.slice(offset, offset + len, 'image/webp'))));
    } else {
      // Gave up on this pack: its frames stay null and the canvas keeps using the
      // nearest decoded frame — one bad pack must not fail the whole scene.
      for (const [i] of pack.frames) {
        this.frames[i] = null;
        this.state[i] = SETTLED;
        this.pending--;
      }
    }
    if (this.cancelled) return;
    this.packState[k] = SETTLED;
    recordEvent('pack-end', { id: this.id, pack: k, level: pack.level, bytes });
    this.onSettled?.(pack.url);
  }

  /** Decodes one frame of a downloaded pack (called by the shared decode queue). */
  async decodeOne(index: number, blob: Blob): Promise<void> {
    let frame: FrameSource | null = null;
    try {
      frame = await decodeFrame(blob);
    } catch {
      frame = null;
    }
    if (this.cancelled) {
      if (frame) closeFrame(frame);
      return;
    }
    this.frames[index] = frame;
    if (frame) {
      liveBytes += this.frameBytes;
      liveBitmaps++;
    }
    this.state[index] = SETTLED;
    this.pending--;
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
// Picks the next pack across all live loaders. Cost = pass number, plus a
// penalty when the loader isn't the active scene, so the order is:
//   active 1/8 → every scene's 1/8 → active 1/4 → next 1/4 → active 1/2 → …
// i.e. every scene gets its coarse pack early (no waiting for lp > 0.6), and
// finer passes go to the active scene first. A pack holding a frame the canvas
// is waiting for (urgent) always goes first.
//
// Non-active scenes are also bounded by the memory budget (a pack is only
// started if its frames still fit) and, for their fine passes, paused while
// the visitor is actively scrolling.
const NEXT_PENALTY = 1.5;
const COARSE_PENALTY = 0.5;
const SCROLL_IDLE_MS = 150;
const FINE_LEVEL = 2;

class FrameScheduler {
  private loaders = new Set<FrameLoader>();
  private active: FrameLoader | null = null;
  private inflight = 0;
  private reserved = 0;           // bytes of packs in flight (not yet in liveBytes)
  private lastScrollAt = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private concurrency = 4;
  private budget = Infinity;
  /**
   * Set by Canvas: frees whatever is furthest from the active scene. Called
   * whenever decoded memory is over budget after a pack lands — the draw loop
   * parks while the scene is at rest, so it can't be relied on to notice.
   */
  onOverBudget?: () => void;
  /**
   * Set by Canvas: false while the Preloader is still waiting. Until it opens,
   * only the active scene's coarse pack is fetched, so the stills and that first
   * pack are not queued behind a connection saturated by everything else.
   */
  gateOpen?: () => boolean;

  /**
   * Concurrency follows the protocol. A pack is ~0.3-0.9 MB, so a few in flight
   * already fill the connection; HTTP/2+ multiplexes them on one connection and
   * HTTP/1.1 is capped at ~6 per host by the browser anyway, and leaving room
   * for the stills and the page's own requests keeps those from queueing behind
   * the packs. Phones (and iOS Safari in particular) decode on less memory/CPU,
   * so they get fewer.
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
    let n = multiplexed ? (phone ? 4 : 6) : (phone ? 3 : 4);
    if (typeof navigator !== 'undefined' && /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
      n = Math.min(n, 3);
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
      const { loader, job } = pick;
      this.inflight++;
      this.reserved += job.bytes;
      loader.fetchPack(job.index).finally(() => {
        this.inflight--;
        this.reserved -= job.bytes;
        if (liveBytes > this.budget) this.onOverBudget?.();
        this.pump();
      });
    }
  }

  private pick(): { loader: FrameLoader; job: PackJob } | null {
    const scrolling = performance.now() - this.lastScrollAt < SCROLL_IDLE_MS;
    const held = this.gateOpen ? !this.gateOpen() : false;
    let best: { loader: FrameLoader; job: PackJob } | null = null;
    let bestCost = Infinity;
    for (const loader of this.loaders) {
      const job = loader.peek();
      if (!job) continue;
      const isActive = loader === this.active;
      if (held && !(isActive && job.level <= 0)) continue;
      let cost = job.level;
      if (!isActive) {
        if (job.level >= FINE_LEVEL && scrolling) continue;
        if (liveBytes + this.reserved + job.bytes > this.budget) continue;
        // Every scene's coarse pack (1/8, ~18 frames) is cheap and is what keeps
        // a fast scrub within 4 frames of the exact one, so it only waits for
        // the active scene's own coarse pack; finer passes queue behind the
        // active scene's.
        cost += job.level === 0 ? COARSE_PENALTY : NEXT_PENALTY;
      }
      if (cost < bestCost) { bestCost = cost; best = { loader, job }; }
    }
    return best;
  }
}

export const frameScheduler = new FrameScheduler();
