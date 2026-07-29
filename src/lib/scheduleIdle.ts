// Runs `fn` when the browser is idle (or after `timeout` ms, whichever comes
// first), so speculative work like prefetching the next scene's frames never
// competes with an in-progress scroll/paint. Falls back to setTimeout on
// browsers without requestIdleCallback (Safari).
export function scheduleIdle(fn: () => void, timeout = 2000): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(fn, { timeout });
  } else {
    setTimeout(fn, 0);
  }
}
