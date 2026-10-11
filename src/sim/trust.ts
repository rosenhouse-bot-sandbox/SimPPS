import { clamp } from '../clamp';
import { M } from './model';
import { REGIONS, regionOfCell } from './regions';
import { draw } from './rng';
import type { Household, SchoolId } from './types';

/** model.trust: family trust by region, 0-100. */
export type Trust = Record<string, number>;

type RegionOf = (h: Household) => string | null;
const byHome: RegionOf = (h) => regionOfCell(h.cell);

const TRUST_DRAW = 30;

export function startTrust(seedHash: number): Trust {
  const { lo, hi } = M.trustStart;
  return Object.fromEntries(REGIONS.map((r, i) => [r, Math.round(lo + (hi - lo) * draw(seedHash, i, 0, TRUST_DRAW))]));
}

/** Trust after a year whose closures took effect this summer. `households` are this fall's. */
export function trustAfterYear(trust: Trust, households: Household[], closing: SchoolId[], regionOf: RegionOf = byHome): Trust {
  const closingSet = new Set(closing);
  const moved = new Map<SchoolId, Map<string, number>>();
  const stirred = new Set<string>();
  const twice = new Set<string>();
  for (const h of households) {
    if (h.movedFrom === undefined) continue;
    const r = regionOf(h);
    if (!r) continue;
    stirred.add(r);
    if ((h.forcedMoves ?? 0) >= 2) twice.add(r);
    if (!closingSet.has(h.movedFrom)) continue;
    const at = moved.get(h.movedFrom) ?? new Map<string, number>();
    at.set(r, (at.get(r) ?? 0) + 1);
    moved.set(h.movedFrom, at);
  }
  const next: Trust = {};
  for (const r of REGIONS) {
    let t = trust[r] + (stirred.has(r) ? 0 : M.trustCalmYear) - (twice.has(r) ? M.trustMovedTwice : 0);
    for (const at of moved.values()) {
      const total = [...at.values()].reduce((a, n) => a + n, 0);
      t -= (M.trustClosure * (at.get(r) ?? 0)) / total;
    }
    next[r] = clamp(t, 0, 100);
  }
  return next;
}

/** Trust across the city, each region weighted by the households living there. */
export function meanTrust(trust: Trust, households: Household[], regionOf: RegionOf = byHome): number {
  let sum = 0;
  let n = 0;
  for (const h of households) {
    if (h.movedAway) continue;
    const r = regionOf(h);
    if (!r) continue;
    sum += trust[r];
    n++;
  }
  return n ? sum / n : 0;
}
