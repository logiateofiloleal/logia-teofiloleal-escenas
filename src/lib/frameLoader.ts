import { tierAssets, type Transition, type FrameTier } from '@/config/segments';
import { scheduleIdle } from '@/lib/scheduleIdle';

// Loads a transition's frame sequence as ImageBitmaps (decoded off-main-thread).
// Memory management: call release() when the segment is far behind (RELEASE_LAG).

// Safari <15.4 doesn't have createImageBitmap; fall back to HTMLImageElement.
const HAS_CREATE_IMAGE_BITMAP = typeof createImageBitmap === 'function';

// Safari iOS has tighter memory limits — fewer concurrent decodes avoids OOM.
const isSafariIOS = typeof navigator !== 'undefined' &&
  /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
const LOAD_CONCURRENCY = isSafariIOS ? 3 : 8;

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

export class FrameLoader {
  private frames: (FrameSource | null)[] = [];
  private lastDrawnIndex = -1;
  private loading = false;

  public cancelled = false;

  private readonly framesDir: string;
  private readonly frameCount: number;
  // Bytes per decoded frame (W*H*4), used for the global memory accounting above.
  private readonly frameBytes: number;

  constructor(transition: Transition, tier: FrameTier, frameBytes: number) {
    const assets    = tierAssets(transition, tier);
    this.framesDir  = assets.framesDir;
    this.frameCount = assets.frameCount;
    this.frameBytes = frameBytes;
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

  /** True while frames are still being fetched/decoded (more may arrive). */
  get isLoading(): boolean {
    return this.loading && !this.cancelled;
  }

  /** Effective frame count (mobile or desktop, whichever this loader was built for). */
  get count(): number {
    return this.frameCount;
  }

  /** Index of the nearest available frame at or before targetIndex, then searching forward (-1 if none). */
  nearestIndex(targetIndex: number): number {
    for (let i = targetIndex; i >= 0; i--) {
      if (this.frames[i]) return i;
    }
    for (let i = targetIndex + 1; i < this.frameCount; i++) {
      if (this.frames[i]) return i;
    }
    return -1;
  }

  /** Returns nearest available frame at or before targetIndex, then searches forward. */
  nearestFrame(targetIndex: number): FrameSource | null {
    const i = this.nearestIndex(targetIndex);
    return i < 0 ? null : this.frames[i];
  }

  /** URL of frame `index` (0-based) — also the key passed to onFrameDone. */
  frameSrc(index: number): string {
    return `${this.framesDir}/frame_${String(index + 1).padStart(4, '0')}.webp`;
  }

  async load(onFrameDone?: (src: string) => void): Promise<void> {
    if (this.loading || this.frameCount === 0 || !this.framesDir) return;
    this.loading = true;

    // Throttled concurrent loading: LOAD_CONCURRENCY fetches in-flight at once.
    // Frames arrive out of order but nearestFrame() handles gaps gracefully.
    const queue = Array.from({ length: this.frameCount }, (_, i) => i);
    let qi = 0;

    const worker = async () => {
      while (qi < queue.length) {
        if (this.cancelled) return;
        const i = queue[qi++];
        const src = this.frameSrc(i);
        try {
          const res = await fetch(src);
          if (this.cancelled) return;
          const blob = await res.blob();
          if (this.cancelled) return;
          const frame = await decodeFrame(blob);
          if (!this.cancelled) {
            this.frames[i] = frame;
            liveBytes += this.frameBytes;
            liveBitmaps++;
          } else {
            closeFrame(frame);
            return;
          }
        } catch {
          this.frames[i] = null;
        }
        onFrameDone?.(src);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(LOAD_CONCURRENCY, this.frameCount) }, worker)
    );

    this.loading = false;
  }

  /**
   * Drops this loader's frames. They stop counting toward the memory budget
   * right away (so Canvas's budget pass never over-releases), and are closed
   * a few at a time off the draw loop — see closeGradually.
   */
  release(): void {
    this.cancelled = true;
    this.loading = false;
    const decoded = this.frames.filter((f): f is FrameSource => f != null);
    liveBytes -= decoded.length * this.frameBytes;
    liveBitmaps -= decoded.length;
    this.frames = [];
    this.lastDrawnIndex = -1;
    if (decoded.length > 0) closeGradually(decoded);
  }
}
