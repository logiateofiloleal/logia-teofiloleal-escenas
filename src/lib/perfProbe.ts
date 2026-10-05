// Measurement-only probe, active with ?perf=1 (no-op otherwise). Counts, per
// transition, how many canvas draws painted the exact frame vs a stand-in
// (nearest decoded frame), how far the stand-in was, and where in the
// transition (lp deciles) it happened. Read from the console or Playwright:
// window.__perfProbe.
import type { StandInCause } from '@/lib/frameLoader';

export interface PerfBucket { draws: number; fallback: number }
export interface PerfTransition {
  draws: number;
  fallback: number;
  noFrame: number;      // nothing decoded at all (start still or stale canvas)
  maxDist: number;      // largest stand-in distance, in frames
  distSum: number;
  far2: number;         // stand-ins 2+ frames away
  far5: number;         // stand-ins 5+ frames away
  byLp: PerfBucket[];   // 10 buckets of lp
  // Why the exact frame was missing: a = not downloaded, b = downloaded but still
  // decoding, c = released earlier and waiting to be re-decoded.
  causes: Record<StandInCause, number>;
  causesFar2: Record<StandInCause, number>;  // same, only stand-ins 2+ frames away
}

const enabled =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('perf') === '1';

const data: Record<string, PerfTransition> = {};

if (enabled) {
  (window as unknown as { __perfProbe: unknown }).__perfProbe = {
    data,
    reset: () => { for (const k of Object.keys(data)) delete data[k]; },
  };
}

/** dist: 0 = exact frame, >0 = stand-in at that distance, -1 = nothing decoded. */
export function recordDraw(id: string, lp: number, dist: number, cause?: StandInCause): void {
  if (!enabled) return;
  const t = (data[id] ??= {
    draws: 0, fallback: 0, noFrame: 0, maxDist: 0, distSum: 0, far2: 0, far5: 0,
    byLp: Array.from({ length: 10 }, () => ({ draws: 0, fallback: 0 })),
    causes: { a: 0, b: 0, c: 0 }, causesFar2: { a: 0, b: 0, c: 0 },
  });
  const b = t.byLp[Math.min(9, Math.max(0, Math.floor(lp * 10)))];
  t.draws++; b.draws++;
  if (dist === 0) return;
  t.fallback++; b.fallback++;
  if (cause) { t.causes[cause]++; if (dist >= 2) t.causesFar2[cause]++; }
  if (dist < 0) { t.noFrame++; return; }
  t.distSum += dist;
  if (dist >= 2) t.far2++;
  if (dist >= 5) t.far5++;
  if (dist > t.maxDist) t.maxDist = dist;
}
