import { costIndex } from './budget';
import {
  effectiveClosures,
  followChance,
  isRiskier,
  miles,
  nearestOpen,
  nonFollowerChoice,
  normalizeClosures,
  schoolPos,
  type FollowFactors,
} from './closures';
import { acrossWillamette } from './geo';
import { gradeOf, M, MAX_GRADE } from './model';
import { SCHOOL_INFO } from './population';
import { modeledRange } from './range';
import { draw } from './rng';
import type { BoundaryEdit, Closure, Flows, GameState, Household, Policy, Range, SchoolId, ZoneLevel } from './types';
import { milesTo, ridesNewBus } from './walk';
import { defaultZones, ENTRY_GRADE, isContiguous, levelOf, mappedZone, nextZone, normalizeBoundaryEdits, sliceCells, zoningYear, type ZoningYear } from './zones';

/** "The N% of zone `from` nearest `to`" moved into `to`'s zone. */
export function sliceEdit(
  state: Pick<GameState, 'households' | 'zones'>,
  level: ZoneLevel,
  from: SchoolId,
  to: SchoolId,
  percent: number,
  grandfather: boolean,
): BoundaryEdit {
  return { level, to, cells: sliceCells(state, level, from, to, percent), grandfather };
}

/**
 * Next fall's new bus riders: continuing kids, kindergartners like this year's at the same homes,
 * and the expected returners. Kids who must move, change levels or lose a closing zone school go
 * to their zone school.
 */
export function projectRiders(
  households: readonly Household[],
  zoning: ZoningYear,
  closed: readonly Pick<Closure, 'school'>[],
  closing: ReadonlySet<SchoolId>,
): number {
  const today = defaultZones();
  if (zoning.zones.elementary === today.elementary && zoning.zones.middle === today.middle) return 0;
  const shut = new Set(closed.map((c) => c.school));
  let n = 0;
  for (const h of households) {
    if (h.movedAway) continue;
    const g = gradeOf(h);
    const ng = g + 1;
    if (ng > MAX_GRADE) continue;
    const { zone, forced } = nextZone(h, ng, zoning, shut);
    if (h.school === null) {
      if (ridesNewBus(h, ng, zone, zone)) n += ng === ENTRY_GRADE.middle ? M.grade6Return : M.returnRate;
      continue;
    }
    if (g === 0 && h.school === h.zoneSchool) {
      const k = zoning.zones.elementary[h.cell];
      if (ridesNewBus(h, 0, k, k)) n++;
    }
    const moves = forced || ng > SCHOOL_INFO.get(h.school)!.hi || (closing.has(h.school) && h.school === h.zoneSchool);
    if (ridesNewBus(h, ng, moves ? zone : h.school, zone)) n++;
  }
  return Math.round(n);
}

/** Arithmetic for a boundary edit. It never predicts family choices. */
export interface BoundaryChip {
  /** Each touched school's kids now and next fall if every moved kid follows the new zone. */
  seats: { school: SchoolId; before: Range; after: Range; capacity: number }[];
  /** Change in PPS K-5 kids within a mile of school once every re-zoned kid attends the new zone school. */
  walk: number;
  /** Homes in the moved cells, in and out of PPS. */
  homes: number;
  /** PPS kids whose zone school changes under them next fall. None when grandfathered. */
  kidsMoving: number;
  /** New bus riders next fall, and once every re-zoned kid attends the new zone school. */
  riders: { now: number; atMaturity: number };
  /** This year's busing dollars. */
  now: Range;
  /** Yearly busing dollars once every re-zoned kid rides, net of the state's repayment. */
  atMaturity: Range;
  /** Every moved cell reaches the new zone through the zone or other moved cells. */
  contiguous: boolean;
}

const span = (a: number, b: number): Range => ({ lo: Math.min(a, b), hi: Math.max(a, b) });

/** `plan` holds the other edits and closures; the edit applies after them. */
export function boundaryChip(state: GameState, edit: BoundaryEdit, plan: Policy): BoundaryChip {
  const closing = effectiveClosures(state.schools, normalizeClosures(plan.closures));
  const closed = [...state.sim!.closed, ...closing];
  const closingNow = new Set(closing.map((c) => c.school));
  const shut = new Set(closed.map((c) => c.school));
  const others = normalizeBoundaryEdits(plan.boundaryEdits);
  const base = zoningYear(state.zones, closed, others);
  const after = zoningYear(state.zones, closed, normalizeBoundaryEdits([...others, edit]));
  const { level } = edit;
  const moved = new Set<number>();
  after.zones[level].forEach((s, c) => s !== base.zones[level][c] && moved.add(c));

  const delta = new Map<SchoolId, number>([[edit.to, 0]]);
  for (const c of moved) delta.set(base.zones[level][c], delta.get(base.zones[level][c]) ?? 0);
  let homes = 0;
  let kidsMoving = 0;
  let walk = 0;
  let mature = 0;
  for (const h of state.households) {
    if (!moved.has(h.cell)) continue;
    homes++;
    if (h.school === null) continue;
    const g = gradeOf(h);
    const ng = g + 1;
    const next = ng <= MAX_GRADE && levelOf(ng) === level ? nextZone(h, ng, after, shut) : null;
    if (next?.forced && !closingNow.has(h.school)) {
      kidsMoving++;
      delta.set(h.school, (delta.get(h.school) ?? 0) - 1);
      delta.set(next.zone, (delta.get(next.zone) ?? 0) + 1);
    }
    if (levelOf(g) !== level || h.school !== h.zoneSchool) continue;
    const nu = mappedZone(after.zones, h, level);
    mature += +ridesNewBus(h, g, nu, nu) - +ridesNewBus(h, g, h.school, h.school);
    if (level === 'elementary') walk += +(milesTo(h, nu) <= M.walkDialMiles) - +(milesTo(h, h.school) <= M.walkDialMiles);
  }
  const now =
    projectRiders(state.households, after, closed, closingNow) - projectRiders(state.households, base, closed, closingNow);
  const index = costIndex(state.year);
  const { busRider: cost, busReimbursed: repaid } = M;
  return {
    seats: [...delta].map(([school, d]) => {
      const s = state.schools[school];
      return { school, before: modeledRange(s.enrollment), after: modeledRange(s.enrollment + d), capacity: s.capacity };
    }),
    walk,
    homes,
    kidsMoving,
    riders: { now, atMaturity: mature },
    now: span(-now * cost.hi * index, -now * cost.lo * index),
    atMaturity: span(-mature * cost.hi * (1 - repaid.lo) * index, -mature * cost.lo * (1 - repaid.hi) * index),
    contiguous: isContiguous(base.zones, { ...edit, cells: [...moved] }),
  };
}

/** Draw purposes for re-zoned kids, apart from step.ts's and closures.ts's. */
const D = { Stay: 40, NonStayer: 41, Away: 42 };

export interface RezoneMover {
  before: Household;
  /** A grade older, with its new zone school and no school yet. */
  next: Household;
  region: { kids: number; leavers: number } | null;
}

/** Where kids who lost their zone school went. */
export interface RezoneTally {
  kids: number;
  /** Kids at the new zone school. */
  zoneSchool: number;
  otherPps: number;
  left: number;
}

export function rezoneFactors(h: Household, target: SchoolId): FollowFactors {
  const to = schoolPos(target);
  return {
    miles: miles(h.pos, to),
    barrier: acrossWillamette(h.pos, to),
    riskier: isRiskier(target, h.school!),
    movedBefore: (h.forcedMoves ?? 0) > 0,
    loyalty: h.loyalty,
    exitCapacity: h.exitCapacity,
    wholeClasses: false,
  };
}

/**
 * Fall after a boundary change moves kids off their zone school: each goes to the new zone school
 * at model.sliceStay with the follow adjustments, or chooses like a closed school's non-follower.
 */
export function decideRezoned(args: {
  seed: number;
  year: number;
  closed: { has(school: SchoolId): boolean };
  movers: RezoneMover[];
  households: Household[];
  flows: Flows;
}): RezoneTally {
  const { seed, year, movers, flows } = args;
  const tally: RezoneTally = { kids: movers.length, zoneSchool: 0, otherPps: 0, left: 0 };
  if (movers.length === 0) return tally;
  const counts = new Map<SchoolId, number>();
  for (const h of args.households) if (h.school !== null) counts.set(h.school, (counts.get(h.school) ?? 0) + 1);
  for (const { before, next, region } of movers) {
    const from = before.school!;
    next.movedFrom = from;
    next.forcedMoves = (before.forcedMoves ?? 0) + 1;
    next.status = 'moved';
    if (draw(seed, year, before.id, D.Stay) < followChance(M.sliceStay, rezoneFactors(before, next.zoneSchool))) {
      next.school = next.zoneSchool;
      tally.zoneSchool++;
    } else if (nonFollowerChoice(draw(seed, year, before.id, D.NonStayer)) === 'otherPps') {
      next.school = nearestOpen(next.pos, gradeOf(next), args.closed, new Set([from, next.zoneSchool]), counts);
      tally.otherPps++;
    } else {
      next.school = null;
      next.status = 'left';
      next.leftThisYear = true;
      if (draw(seed, year, before.id, D.Away) < M.awayShare) next.movedAway = true;
      flows.leftPps++;
      if (region) region.leavers++;
      tally.left++;
      continue;
    }
    counts.set(next.school, (counts.get(next.school) ?? 0) + 1);
    flows.movedWithinPps++;
  }
  return tally;
}
