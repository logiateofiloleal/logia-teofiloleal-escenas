import { SEGMENTS } from '@/config/segments';

// How far into a station segment a jump should land (0 = its first pixel).
const DWELL_RATIO = 0.35;

/**
 * scrollY resting position for every station, derived from SEGMENTS so it
 * can't drift from the real layout. Station 0 (s1, El Umbral) = page top;
 * station N = start of its segment + DWELL_RATIO × its height.
 *
 * Pure (takes the viewport height) so it works outside SceneSnapProvider —
 * e.g. the Header, which also renders on secondary pages.
 */
export function stationDwells(vh: number): number[] {
  const dwells: number[] = [0]; // s1 implícito
  let cumPx = 0;
  for (const seg of SEGMENTS) {
    const segPx = (seg.scrollVh / 100) * vh;
    if (seg.type === 'station') {
      dwells.push(cumPx + segPx * DWELL_RATIO);
    }
    cumPx += segPx;
  }
  return dwells;
}

/** scrollY for one station index (0 = El Umbral … 3 = La Puerta). */
export function stationScrollY(station: number, vh: number): number {
  return stationDwells(vh)[station] ?? 0;
}
