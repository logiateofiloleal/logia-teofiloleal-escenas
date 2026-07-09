// Tracks readiness of the assets required for the first paint of the
// experience (station/transition stills + the first transition's frame
// sequence). Preloader waits on this instead of a fixed timer.

type Listener = () => void;

// total = -1 means Canvas hasn't reported the real asset count yet —
// progress must read as 0 / not-ready until it does (avoids a race where
// Preloader's first tick reads a default "nothing to load" state).
let total = -1;
let loaded = 0;
let ready = false;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach(cb => cb());
}

export function resetPreloadGate(expectedTotal: number): void {
  total = expectedTotal;
  loaded = 0;
  ready = expectedTotal <= 0;
  notify();
}

export function reportPreloadItemDone(): void {
  if (ready) return;
  loaded = Math.min(loaded + 1, total);
  if (total >= 0 && loaded >= total) ready = true;
  notify();
}

export function getPreloadProgress(): number {
  if (total <= 0) return 0;
  return Math.min(loaded / total, 1);
}

export function isPreloadReady(): boolean {
  return ready;
}

export function subscribePreload(cb: Listener): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function waitForPreloadReady(): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise(resolve => {
    const unsub = subscribePreload(() => {
      if (ready) { unsub(); resolve(); }
    });
  });
}
