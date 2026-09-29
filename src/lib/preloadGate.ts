// Tracks readiness of the assets required for the first paint of the
// experience (station/transition stills + the first transition's frame
// sequence). Preloader waits on this instead of a fixed timer.
//
// Items are tracked by key (the asset URL), not by a bare counter:
// - declaring the expected set again (e.g. Canvas's preload effect re-runs
//   once useFrameTier settles) never forgets items already reported;
// - reporting the same item twice (duplicate load listeners) is a no-op.
//
// A watchdog guarantees the gate always resolves: if loading stalls (a
// request that never settles, a cancelled loader, an error before the
// expected set is declared) the gate is forced open, so the Preloader can
// never lock the page forever. Canvas already degrades gracefully when
// frames are missing (start still / nearest decoded frame).

type Listener = () => void;

// No progress for this long → give up waiting. Each frame is ~15–50KB, so
// even slow 3G reports progress well within this window while it's alive.
const STALL_MS = 8000;
// Absolute cap from the moment anything starts waiting on the gate.
const MAX_WAIT_MS = 30000;

// null = Canvas hasn't declared the expected set yet — progress reads as 0 /
// not-ready until it does (avoids a race where Preloader's first tick reads
// a default "nothing to load" state).
let expected: Set<string> | null = null;
const done = new Set<string>();
let ready = false;
const listeners = new Set<Listener>();

let watchdogStarted = false;
let lastProgressAt = 0;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

function notify(): void {
  listeners.forEach(cb => cb());
}

function loadedCount(): number {
  if (!expected) return 0;
  let n = 0;
  expected.forEach(key => { if (done.has(key)) n++; });
  return n;
}

function markReady(): void {
  if (ready) return;
  ready = true;
  if (watchdogTimer != null) { clearInterval(watchdogTimer); watchdogTimer = null; }
  notify();
}

function checkReady(): void {
  if (expected && loadedCount() >= expected.size) markReady();
}

function ensureWatchdog(): void {
  if (watchdogStarted || ready || typeof window === 'undefined') return;
  watchdogStarted = true;
  const startedAt = Date.now();
  lastProgressAt = startedAt;
  watchdogTimer = setInterval(() => {
    const now = Date.now();
    if (now - lastProgressAt >= STALL_MS || now - startedAt >= MAX_WAIT_MS) {
      console.warn(
        `[preloadGate] releasing after ${now - startedAt}ms with ` +
        `${loadedCount()}/${expected?.size ?? '?'} items loaded`,
      );
      markReady();
    }
  }, 500);
}

/** Declares (or re-declares) the full set of asset keys the gate waits for. */
export function expectPreloadItems(keys: Iterable<string>): void {
  expected = new Set(keys);
  lastProgressAt = Date.now();
  ensureWatchdog();
  checkReady();
  notify();
}

/** Marks one asset as settled (loaded or failed). Idempotent per key. */
export function reportPreloadItemDone(key: string): void {
  if (ready || done.has(key)) return;
  done.add(key);
  lastProgressAt = Date.now();
  checkReady();
  notify();
}

export function getPreloadProgress(): number {
  // Polling progress also counts as waiting — starts the watchdog even if
  // Canvas never got to declare its expected set (e.g. it threw on mount).
  ensureWatchdog();
  if (ready) return 1;
  if (!expected || expected.size === 0) return 0;
  return Math.min(loadedCount() / expected.size, 1);
}

export function isPreloadReady(): boolean {
  return ready;
}

export function subscribePreload(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function waitForPreloadReady(): Promise<void> {
  ensureWatchdog();
  if (ready) return Promise.resolve();
  return new Promise(resolve => {
    const unsub = subscribePreload(() => {
      if (ready) { unsub(); resolve(); }
    });
  });
}
