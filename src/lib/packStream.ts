// Cuts a frame pack apart while it is still downloading.
//
// A pack (scripts/build-frame-packs.mjs) is ~16-18 WebP frames concatenated; the
// generated index says where each one sits. Waiting for the whole pack before
// decoding anything made a 0.8 MB pack useless until its last byte arrived —
// with several packs sharing the connection, every one of them landed late and
// together. PackAssembler hands each frame out the moment its byte range is
// complete, so decoding starts while the rest is still on the wire.
//
// No imports on purpose: scripts/verify-frame-packs.mjs runs this file as-is.

/** [frame index, byte offset in the pack, byte length] — as in framePacks.generated.ts. */
export type PackFrame = readonly [number, number, number];

export interface CompletedFrame {
  index: number;
  blob: Blob;
}

export class PackAssembler {
  readonly totalLength: number;
  private frames: PackFrame[];
  private buf: Uint8Array<ArrayBuffer>;
  private received = 0;
  private next = 0; // next frame (in offset order) not yet handed out

  constructor(frames: ReadonlyArray<PackFrame>, totalLength: number) {
    this.totalLength = totalLength;
    this.frames = [...frames].sort((a, b) => a[1] - b[1]);
    this.buf = new Uint8Array(totalLength);
  }

  /** Appends the next chunk of the response body; returns the frames it completed. */
  push(chunk: Uint8Array): CompletedFrame[] {
    if (this.received + chunk.length > this.totalLength) {
      throw new Error('pack is longer than its index says');
    }
    this.buf.set(chunk, this.received);
    this.received += chunk.length;
    const done: CompletedFrame[] = [];
    while (this.next < this.frames.length) {
      const [index, offset, length] = this.frames[this.next];
      if (offset + length > this.received) break;
      done.push({ index, blob: new Blob([this.buf.subarray(offset, offset + length)], { type: 'image/webp' }) });
      this.next++;
    }
    return done;
  }

  /** True once every byte has arrived and every frame has been handed out. */
  get complete(): boolean {
    return this.received === this.totalLength && this.next === this.frames.length;
  }
}
