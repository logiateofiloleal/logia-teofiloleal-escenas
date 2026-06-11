import type { Transition } from '@/config/segments';

// Loads a transition's frame sequence as ImageBitmaps (decoded off-main-thread).
// Memory management: call release() when the segment is far behind (RELEASE_LAG).

export class FrameLoader {
  private frames: (ImageBitmap | null)[] = [];
  private lastDrawnIndex = -1;
  private loading = false;

  // Set to true before releasing to abort any in-flight fetch loop
  public cancelled = false;

  private readonly framesDir: string;
  private readonly frameCount: number;

  constructor(transition: Transition, isMobile: boolean) {
    // TODO: swap base path for mobile once frames-mobile/ assets are produced:
    // if (isMobile && transition.framesDir) {
    //   this.framesDir = transition.framesDir.replace('/frames/desktop/', '/frames/mobile/');
    // }
    void isMobile; // suppress unused-var until mobile assets exist
    this.framesDir = transition.framesDir ?? '';
    this.frameCount = transition.frameCount;
  }

  getFrame(index: number): ImageBitmap | null {
    return this.frames[index] ?? null;
  }

  getLastValid(): ImageBitmap | null {
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

  async load(): Promise<void> {
    // Guard: prevent parallel loads and no-op for placeholder segments
    if (this.loading || this.frameCount === 0 || !this.framesDir) return;
    this.loading = true;

    for (let i = 0; i < this.frameCount; i++) {
      if (this.cancelled) break;

      const pad = String(i + 1).padStart(4, '0');
      const src = `${this.framesDir}/frame_${pad}.webp`;

      try {
        const res = await fetch(src);
        if (this.cancelled) break;
        const blob = await res.blob();
        if (this.cancelled) break;
        const bitmap = await createImageBitmap(blob);
        if (!this.cancelled) {
          this.frames[i] = bitmap;
        } else {
          bitmap.close();
          break;
        }
      } catch {
        this.frames[i] = null;
      }
    }

    this.loading = false;
  }

  release(): void {
    this.cancelled = true;
    this.loading = false;
    for (const bmp of this.frames) {
      if (bmp) bmp.close();
    }
    this.frames = [];
    this.lastDrawnIndex = -1;
  }
}
