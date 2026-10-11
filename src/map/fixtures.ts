import { SCHOOLS, ZONES, type Point } from '../data';
import type { Household, HouseholdStatus, SchoolId, SchoolState } from '../sim/types';
import { pointInRings } from './geometry';
import { boundsOf } from './projection';

const GRADES: Record<string, [number, number]> = { K5: [0, 5], K8: [0, 8], MS: [6, 8], ALT: [0, 8] };

/** Fall 2025 schools, for building the map before the simulation lands. */
export function fixtureSchools(): Record<SchoolId, SchoolState> {
  const out: Record<SchoolId, SchoolState> = {};
  for (const s of SCHOOLS) {
    const enrollment = s.enrollment ?? 0;
    const [lo, hi] = GRADES[s.level];
    const byGrade = Array<number>(9).fill(0);
    for (let i = 0; i < enrollment; i++) byGrade[lo + (i % (hi - lo + 1))]++;
    out[s.id] = {
      id: s.id,
      open: true,
      enrollment,
      byGrade,
      capacity: Math.round(s.capacity ?? 0),
      homerooms: Math.ceil(enrollment / 24),
      blendedHomerooms: 0,
    };
  }
  return out;
}

const STATUSES: [HouseholdStatus, number][] = [
  ['stayed', 0.8],
  ['moved', 0.1],
  ['left', 0.06],
  ['returned', 0.04],
];

/** Fake households scattered inside elementary zones. */
export function fixtureHouseholds(n = 400, seed = 1): Household[] {
  const rand = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const zones = ZONES.elementary;
  const out: Household[] = [];
  for (let id = 0; id < n; id++) {
    const zone = pick(zones);
    const b = boundsOf(zone.rings.flat());
    let pos: Point;
    do pos = [Math.round(b.minX + rand() * (b.maxX - b.minX)), Math.round(b.minY + rand() * (b.maxY - b.minY))];
    while (!pointInRings(pos, zone.rings));
    let r = rand();
    const status = STATUSES.find(([, w]) => (r -= w) < 0)?.[0] ?? 'stayed';
    const kids = Array<number>(9).fill(0);
    kids[Math.floor(rand() * 9)] = 1;
    out.push({
      id,
      pos,
      kids,
      zoneSchool: zone.school,
      school: status === 'left' ? null : status === 'moved' ? pick(zones).school : zone.school,
      exitCapacity: rand(),
      loyalty: rand(),
      voice: rand(),
      status,
      leftThisYear: status === 'left' || undefined,
    });
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
