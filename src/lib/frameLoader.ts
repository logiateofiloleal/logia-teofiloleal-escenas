import type { Transition } from '@/config/segments';

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

export class FrameLoader {
  private frames: (FrameSource | null)[] = [];
  private lastDrawnIndex = -1;
  private loading = false;

  public cancelled = false;

  private readonly framesDir: string;
  private readonly frameCount: number;

  constructor(transition: Transition, isMobile: boolean) {
    if (isMobile && transition.framesDirMobile) {
      this.framesDir  = transition.framesDirMobile;
      this.frameCount = transition.frameCountMobile ?? transition.frameCount;
    } else {
      this.framesDir  = transition.framesDir ?? '';
      this.frameCount = transition.frameCount;
    }
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

  /** Effective frame count (mobile or desktop, whichever this loader was built for). */
  get count(): number {
    return this.frameCount;
  }

  /** Returns nearest available frame at or before targetIndex, then searches forward. */
  nearestFrame(targetIndex: number): FrameSource | null {
    for (let i = targetIndex; i >= 0; i--) {
      if (this.frames[i]) return this.frames[i]!;
    }
    for (let i = targetIndex + 1; i < this.frameCount; i++) {
      if (this.frames[i]) return this.frames[i]!;
    }
    return null;
  }

  async load(onFrameDone?: () => void): Promise<void> {
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
        const pad = String(i + 1).padStart(4, '0');
        const src = `${this.framesDir}/frame_${pad}.webp`;
        try {
          const res = await fetch(src);
          if (this.cancelled) return;
          const blob = await res.blob();
          if (this.cancelled) return;
          const frame = await decodeFrame(blob);
          if (!this.cancelled) {
            this.frames[i] = frame;
          } else {
            closeFrame(frame);
            return;
          }
        } catch {
          this.frames[i] = null;
        }
        onFrameDone?.();
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(LOAD_CONCURRENCY, this.frameCount) }, worker)
    );

    this.loading = false;
  }

  release(): void {
    this.cancelled = true;
    this.loading = false;
    for (const frame of this.frames) {
      if (frame) closeFrame(frame);
    }
    this.frames = [];
    this.lastDrawnIndex = -1;
  }
}
