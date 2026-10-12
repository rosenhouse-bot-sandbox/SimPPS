import { costIndex } from './budget';
import {
  crowdedOut,
  effectiveClosures,
  followChance,
  leavePps,
  moveFactors,
  nearestOpen,
  nonFollowerChoice,
  normalizeClosures,
  type FollowFactors,
} from './closures';
import type { Shut } from './gradeSpan';
import { gradeOf, M, MAX_GRADE } from './model';
import { SCHOOL_INFO } from './population';
import { modeledRange } from './range';
import { draw } from './rng';
import type { BoundaryEdit, ClosedSchool, Closure, Flows, GameState, GradeSpanChange, Household, Policy, Range, SchoolId, ZoneLevel } from './types';
import { milesTo, ridesNewBus } from './walk';
import { defaultZones, ENTRY_GRADE, homesByCell, isContiguous, levelOf, mappedZone, nextZone, normalizeBoundaryEdits, sliceCells, zoningYear, type ZoningYear } from './zones';

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

/** Next fall's zones: closures and grade-span changes in force re-zone first, then `edits` apply. */
export function planZoning<C extends Closure>(
  state: Pick<GameState, 'households' | 'zones' | 'sim'>,
  closing: readonly C[],
  edits: readonly BoundaryEdit[],
  converting: readonly GradeSpanChange[] = [],
): { closed: (ClosedSchool | C)[]; closingNow: Set<SchoolId>; zoning: ZoningYear } {
  const closed: (ClosedSchool | C)[] = [...state.sim!.closed, ...closing];
  const zoning = zoningYear(state.zones, closed, edits, homesByCell(state.households), converting);
  return { closed, closingNow: new Set(closing.map((c) => c.school)), zoning };
}

/** Next fall's new bus riders under a plan. */
export function plannedRiders(households: readonly Household[], plan: ReturnType<typeof planZoning<Closure>>): number {
  return projectRiders(households, plan.zoning, plan.closed, plan.closingNow);
}

/** New bus riders next fall that `closure` adds to the plan's other closures. */
export function closureRiders(state: GameState, closure: Closure, plan: Closure[]): number {
  const others = plan.filter((c) => c.school !== closure.school);
  const riders = (closures: Closure[]) =>
    plannedRiders(state.households, planZoning(state, effectiveClosures(state.schools, normalizeClosures(closures)), []));
  return riders([...others, closure]) - riders(others);
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
    const level = levelOf(ng);
    const was = today[level][h.cell];
    // Only a zone that differs from today's makes a new rider.
    if (zoning.zones[level][h.cell] === was && (ng === ENTRY_GRADE.middle || h.zoneSchool === was)) continue;
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

/** A boundary chip shows arithmetic and never predicts family choices. */
export interface BoundaryChip {
  /** Each touched school's kids now, next fall if every moved kid follows the new zone, and once every zone kid in the blocks attends the new zone school. */
  seats: { school: SchoolId; before: Range; after: Range; mature: Range; capacity: number }[];
  /** Change in PPS K-5 kids within a mile of school once every re-zoned kid attends the new zone school. */
  walk: number;
  /** K-8 kids living in the moved cells, in and out of PPS. Each household holds one kid. */
  residents: number;
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
  const others = normalizeBoundaryEdits(plan.boundaryEdits);
  const before = planZoning(state, closing, others);
  const later = planZoning(state, closing, normalizeBoundaryEdits([...others, edit]));
  const { closingNow, closed } = before;
  const shut = new Set(closed.map((c) => c.school));
  const [base, after] = [before.zoning, later.zoning];
  const { level } = edit;
  const moved = new Set<number>();
  after.zones[level].forEach((s, c) => s !== base.zones[level][c] && moved.add(c));

  const delta = new Map<SchoolId, number>([[edit.to, 0]]);
  for (const c of moved) delta.set(base.zones[level][c], delta.get(base.zones[level][c]) ?? 0);
  let residents = 0;
  let kidsMoving = 0;
  let walk = 0;
  let mature = 0;
  const matureDelta = new Map<SchoolId, number>();
  const shift = (school: SchoolId, d: number) => matureDelta.set(school, (matureDelta.get(school) ?? 0) + d);
  for (const h of state.households) {
    if (!moved.has(h.cell)) continue;
    residents++;
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
    shift(h.school, -1);
    shift(nu, 1);
    mature += +ridesNewBus(h, g, nu, nu) - +ridesNewBus(h, g, h.school, h.school);
    if (level === 'elementary') walk += +(milesTo(h, nu) <= M.walkDialMiles) - +(milesTo(h, h.school) <= M.walkDialMiles);
  }
  const now = plannedRiders(state.households, later) - plannedRiders(state.households, before);
  const index = costIndex(state.year);
  const { busRider: cost, busReimbursed: repaid } = M;
  return {
    seats: [...delta].map(([school, d]) => {
      const s = state.schools[school];
      return {
        school,
        before: modeledRange(s.enrollment),
        after: modeledRange(s.enrollment + d),
        mature: modeledRange(s.enrollment + (matureDelta.get(school) ?? 0)),
        capacity: s.capacity,
      };
    }),
    walk,
    residents,
    kidsMoving,
    riders: { now, atMaturity: mature },
    now: span(-now * cost.hi * index, -now * cost.lo * index),
    atMaturity: span(-mature * cost.hi * (1 - repaid.lo) * index, -mature * cost.lo * (1 - repaid.hi) * index),
    contiguous: isContiguous(base.zones, { ...edit, cells: [...moved] }),
  };
}

/** Draw purposes for re-zoned kids, apart from step.ts's and closures.ts's. */
const D = { Stay: 40, NonStayer: 41, Away: 42, Crowd: 43 };

export interface RezoneMover {
  before: Household;
  /** A grade older, with its new zone school and no school yet. */
  next: Household;
  region: { kids: number; leavers: number } | null;
  /** Where the kid is sent, when not its new zone school. */
  target?: SchoolId;
}

/** Where kids who lost their zone school went. */
export interface RezoneTally {
  kids: number;
  /** Kids at the school they were sent to. */
  zoneSchool: number;
  otherPps: number;
  left: number;
}

export function rezoneFactors(h: Household, target: SchoolId): FollowFactors {
  return moveFactors(h, h.school!, target, false);
}

/**
 * Fall after a boundary change or grade-span change moves kids off their school: each goes where it
 * is sent at `stay` (model.sliceStay by default) with the follow adjustments, or chooses like a
 * closed school's non-follower.
 * A new zone school past the crowding line sends its newest arrivals on.
 */
export function decideRezoned(args: {
  seed: number;
  year: number;
  closed: Shut;
  movers: RezoneMover[];
  households: Household[];
  flows: Flows;
  /** The base chance a mover goes where it is sent. */
  stay?: number;
}): RezoneTally {
  const { seed, year, movers, flows } = args;
  const tally: RezoneTally = { kids: movers.length, zoneSchool: 0, otherPps: 0, left: 0 };
  if (movers.length === 0) return tally;
  const counts = new Map<SchoolId, number>();
  for (const h of args.households) if (h.school !== null) counts.set(h.school, (counts.get(h.school) ?? 0) + 1);
  const add = (id: SchoolId, n: number) => counts.set(id, (counts.get(id) ?? 0) + n);
  const otherPps = ({ before, next, target }: RezoneMover) => {
    const exclude = new Set([before.school!, next.zoneSchool, target ?? next.zoneSchool]);
    next.school = nearestOpen(next.pos, gradeOf(next), args.closed, exclude, counts);
    add(next.school, 1);
    tally.otherPps++;
  };
  const arrivals = new Map<SchoolId, RezoneMover[]>();
  for (const m of movers) {
    const { before, next } = m;
    next.movedFrom = before.school!;
    next.forcedMoves = (before.forcedMoves ?? 0) + 1;
    next.status = 'moved';
    const target = m.target ?? next.zoneSchool;
    if (draw(seed, year, before.id, D.Stay) < followChance(args.stay ?? M.sliceStay, rezoneFactors(before, target))) {
      next.school = target;
      add(next.school, 1);
      arrivals.set(next.school, [...(arrivals.get(next.school) ?? []), m]);
      tally.zoneSchool++;
    } else {
      const choice = nonFollowerChoice(draw(seed, year, before.id, D.NonStayer));
      if (choice !== 'otherPps') {
        leavePps(next, choice, draw(seed, year, before.id, D.Away), flows, m.region);
        tally.left++;
        continue;
      }
      otherPps(m);
    }
    flows.movedWithinPps++;
  }
  for (const [school, m] of crowdedOut(arrivals, counts, (m) => draw(seed, year, m.before.id, D.Crowd))) {
    add(school, -1);
    tally.zoneSchool--;
    otherPps(m);
  }
  return tally;
}
