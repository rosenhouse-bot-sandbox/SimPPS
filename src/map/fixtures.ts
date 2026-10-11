import { SCHOOLS, ZONES } from '../data';
import { samplePoint } from '../sim/geo';
import { stream } from '../sim/rng';
import type { Household, HouseholdStatus, SchoolId, SchoolState } from '../sim/types';

const GRADES: Record<string, [number, number]> = { K5: [0, 5], K8: [0, 8], MS: [6, 8], ALT: [0, 8] };

/** Fall 2025 schools. */
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
      stateRevenue: 0,
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
  const rand = stream(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const zones = ZONES.elementary;
  const out: Household[] = [];
  for (let id = 0; id < n; id++) {
    const zone = pick(zones);
    const pos = samplePoint(zone, rand);
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
