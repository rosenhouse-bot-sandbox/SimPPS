import { clamp } from '../clamp';
import type { Point } from '../data';
import { classesFor, costIndex, MEDIAN_SQFT, otherStaff, stateWeight } from './budget';
import { acrossWillamette } from './geo';
import { gradeOf, M, METERS_PER_MILE } from './model';
import { SCHOOL_INFO, type SchoolInfo } from './population';
import { modeledRange } from './range';
import { draw, hashString } from './rng';
import type {
  ClosedSchool,
  Closure,
  ClosureOutcome,
  Flows,
  GameState,
  Household,
  Range,
  SchoolId,
  SchoolState,
} from './types';

export interface FollowFactors {
  /** Straight-line miles from home to the receiver. */
  miles: number;
  /** The Willamette runs between home and the receiver. */
  barrier: boolean;
  /** The receiver is URM without a full retrofit and the closed school is not. */
  riskier: boolean;
  /** A closure moved the household before. */
  movedBefore: boolean;
  loyalty: number;
  exitCapacity: number;
  /** One receiver takes every class. */
  wholeClasses: boolean;
}

/** model.followAdjustments: the chance a closed school's kid follows it to the receiver. */
export function followChance(base: number, f: FollowFactors): number {
  return clamp(
    base -
      M.followPerMilePastOne * Math.max(0, f.miles - 1) -
      (f.barrier ? M.followBarrier : 0) -
      (f.riskier ? M.followRiskier : 0) -
      (f.movedBefore ? M.followMovedTwice : 0) -
      M.followLoyal * f.loyalty -
      M.followExit * f.exitCapacity +
      (f.wholeClasses ? M.followWholeClasses : 0),
    0,
    1,
  );
}

export type NonFollowerChoice = 'otherPps' | 'charter' | 'left';

/** model.nonFollowers */
export function nonFollowerChoice(u: number): NonFollowerChoice {
  if (u < M.nonFollowerOtherPps) return 'otherPps';
  if (u < M.nonFollowerOtherPps + M.nonFollowerCharter) return 'charter';
  return 'left';
}

const MAX_RECEIVERS = 2;

/** Shares rescaled to sum to 1, or equal when none is positive. */
export function renormalize(receivers: Closure['receivers']): Closure['receivers'] {
  const total = receivers.reduce((a, r) => a + r.share, 0);
  return receivers.map((r) => ({ school: r.school, share: total > 0 ? r.share / total : 1 / receivers.length }));
}

/** Schools that take neighborhood kids: a zone, not a citywide program. */
const isZoned = (i: SchoolInfo) => i.elemZone >= 0 || i.middleZone >= 0;
const ZONED = [...SCHOOL_INFO.values()].filter(isZoned);

/** An open school with K-8 kids. */
export function canClose(schools: Record<SchoolId, SchoolState>, school: SchoolId): boolean {
  return !!schools[school]?.open && (SCHOOL_INFO.get(school)?.k8 ?? 0) > 0;
}

/** A neighborhood school that serves some of the closing school's grades. */
export function canReceive(closing: SchoolId, receiver: SchoolId): boolean {
  const from = SCHOOL_INFO.get(closing);
  const to = SCHOOL_INFO.get(receiver);
  return !!from && !!to && receiver !== closing && isZoned(to) && to.lo <= from.hi && to.hi >= from.lo;
}

/**
 * Keeps one closure per school with K-8 kids and 1-2 distinct receivers that can take its kids and
 * are not closing, with shares that sum to 1. A closure left with no receiver is dropped.
 */
export function normalizeClosures(closures: Closure[]): Closure[] {
  const seen = new Set<string>();
  const unique = closures.filter(
    (c) => (SCHOOL_INFO.get(c.school)?.k8 ?? 0) > 0 && !seen.has(c.school) && seen.add(c.school),
  );
  const closing = new Set(unique.map((c) => c.school));
  return unique.flatMap((c) => {
    const picked = new Set<string>();
    const receivers = c.receivers
      .filter((r) => canReceive(c.school, r.school) && !closing.has(r.school) && !picked.has(r.school) && picked.add(r.school))
      .slice(0, MAX_RECEIVERS)
      .map((r) => ({ school: r.school, share: Math.max(0, Number.isFinite(r.share) ? r.share : 0) }));
    if (receivers.length === 0) return [];
    const out: Closure = { ...c, receivers: renormalize(receivers) };
    if (out.guess === undefined || !Number.isFinite(out.guess)) delete out.guess;
    else out.guess = Math.max(0, Math.round(out.guess));
    return [out];
  });
}

/** Closures of open schools, kept to their open receivers. */
export function effectiveClosures(schools: Record<SchoolId, SchoolState>, closures: Closure[]): Closure[] {
  return closures.flatMap((c) => {
    const receivers = c.receivers.filter((r) => schools[r.school]?.open);
    return schools[c.school]?.open && receivers.length ? [{ ...c, receivers: renormalize(receivers) }] : [];
  });
}

function serves(school: SchoolId, grade: number): boolean {
  const info = SCHOOL_INFO.get(school)!;
  return grade >= info.lo && grade <= info.hi;
}

/** Receivers that serve a grade, shares renormalized. Empty when none does. */
export function receiversFor(closure: Pick<Closure, 'receivers'>, grade: number): Closure['receivers'] {
  return renormalize(closure.receivers.filter((r) => serves(r.school, grade)));
}

const sum = (xs: number[]) => xs.reduce((a, n) => a + n, 0);

/** Schools after every kid of the closed school follows to the receivers that serve its grade. */
export function withArrivals(schools: Record<SchoolId, SchoolState>, closure: Closure): Record<SchoolId, SchoolState> {
  const closed = schools[closure.school];
  const out = { ...schools };
  for (const r of closure.receivers) {
    const s = schools[r.school];
    const byGrade = s.byGrade.map((n, g) => {
      const share = receiversFor(closure, g).find((x) => x.school === r.school)?.share ?? 0;
      return n + Math.round(share * closed.byGrade[g]);
    });
    out[r.school] = { ...s, byGrade, enrollment: s.enrollment + sum(byGrade) - sum(s.byGrade) };
  }
  return out;
}

function plant(school: SchoolId): number {
  return (SCHOOL_INFO.get(school)!.data.squareFeet ?? MEDIAN_SQFT) * M.plantPerSqft;
}

function siteCost(school: SchoolId, byGrade: number[], enrollment: number, classSize: number): number {
  return (
    classesFor(byGrade, classSize).homerooms * M.homeroomCost + otherStaff(enrollment) * M.positionCost + plant(school)
  );
}

/**
 * model.closureSavings: the closed school's staff beyond the principal's office follow its kids and
 * fill the receivers' new staff steps. Those left over stay on the payroll.
 */
export function staffKept(schools: Record<SchoolId, SchoolState>, closure: Closure): number {
  const after = withArrivals(schools, closure);
  const steps = sum(closure.receivers.map((r) => otherStaff(after[r.school].enrollment) - otherStaff(schools[r.school].enrollment)));
  return Math.max(0, otherStaff(schools[closure.school].enrollment) - M.principalOffice - steps);
}

/**
 * model.closureSavings: the yearly saving if every kid follows, in 2027-28 dollars. The closed
 * building's plant and principal's office go. Receivers add the homerooms and staff steps the
 * arriving kids need, and kids in grades no receiver serves fill middle-grade classes elsewhere.
 */
export function closureSaving(schools: Record<SchoolId, SchoolState>, closure: Closure, classSize: number): number {
  const closed = schools[closure.school];
  const after = withArrivals(schools, closure);
  let saving = siteCost(closed.id, closed.byGrade, closed.enrollment, classSize) - staffKept(schools, closure) * M.positionCost;
  closed.byGrade.forEach((n, g) => {
    if (receiversFor(closure, g).length === 0) saving -= (n / M.msClassSize) * M.homeroomCost;
  });
  for (const r of closure.receivers) {
    const [s, t] = [schools[r.school], after[r.school]];
    saving += siteCost(s.id, s.byGrade, s.enrollment, classSize) - siteCost(t.id, t.byGrade, t.enrollment, classSize);
  }
  return saving;
}

/** This year's closures that can happen, each priced after the ones before it have moved in. */
export function closuresTakingEffect(
  schools: Record<SchoolId, SchoolState>,
  closures: Closure[],
  classSize: number,
  year: number,
): ClosedSchool[] {
  let at = schools;
  return effectiveClosures(schools, closures).map((c) => {
    const closed = { ...c, year, saving: closureSaving(at, c, classSize), staffKept: staffKept(at, c) };
    at = withArrivals(at, c);
    return closed;
  });
}

export function schoolPos(school: SchoolId): Point {
  const { x, y } = SCHOOL_INFO.get(school)!.data;
  return [x, y];
}

export function miles(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) / METERS_PER_MILE;
}

/** Arithmetic for a closure. It never predicts family choices. */
export interface ClosureChip {
  /** Receivers' kids and seats if every kid follows. */
  seats: { kids: number; capacity: number };
  /** Kids still in the school's grades next fall, who must choose. */
  kidsMoving: number;
  /** Average added straight-line miles from home, modeled. */
  walkMiles: number;
  /** This year's dollars: the one-time cost. */
  now: Range;
  /** Yearly dollars from fall `maturesIn`, net of building upkeep. */
  atMaturity: Range;
  maturesIn: number;
  /** Kids who may leave PPS before lost revenue cancels the saving. */
  paysOffIfFewerThan: number;
}

/** `plan` holds the other closures in the plan; their kids count at shared receivers. */
export function closureChip(
  state: Pick<GameState, 'year' | 'schools' | 'households'>,
  closure: Closure,
  plan: Closure[],
  classSize: number,
): ClosureChip {
  const schools = effectiveClosures(
    state.schools,
    plan.filter((c) => c.school !== closure.school),
  ).reduce(withArrivals, state.schools);
  const after = withArrivals(schools, closure);
  const home = schoolPos(closure.school);
  const kids = state.households.filter((h) => h.school === closure.school);
  const hi = SCHOOL_INFO.get(closure.school)!.hi;
  let walkers = 0;
  let added = 0;
  for (const h of kids) {
    const serving = receiversFor(closure, gradeOf(h));
    if (serving.length) walkers++;
    for (const r of serving) added += r.share * (miles(h.pos, schoolPos(r.school)) - miles(h.pos, home));
  }
  const maturesIn = state.year + M.closurePhasing.length - 1;
  const upkeep = closure.building === 'mothball' ? M.mothball : 0;
  const net = (closureSaving(schools, closure, classSize) - upkeep) * costIndex(maturesIn);
  const index = costIndex(state.year);
  return {
    seats: {
      kids: sum(closure.receivers.map((r) => after[r.school].enrollment)),
      capacity: sum(closure.receivers.map((r) => schools[r.school].capacity)),
    },
    kidsMoving: kids.filter((h) => gradeOf(h) < hi).length,
    walkMiles: walkers ? added / walkers : 0,
    now: { lo: -M.closureOneTime.hi * index, hi: -M.closureOneTime.lo * index },
    atMaturity: { lo: net * (1 - M.closureSavingsSpread), hi: net * (1 + M.closureSavingsSpread) },
    maturesIn,
    paysOffIfFewerThan: Math.max(0, Math.floor(net / stateWeight(closure.school))),
  };
}

/** Open neighborhood schools that can take the closing school's kids, nearest first. Plan closures can't receive. */
export function receiverCandidates(
  schools: Record<SchoolId, SchoolState>,
  closing: SchoolId,
  plan: Closure[],
): { id: SchoolId; miles: number; kids: number; capacity: number }[] {
  const busy = new Set(plan.map((c) => c.school));
  const home = schoolPos(closing);
  return ZONED.map((i) => schools[i.data.id])
    .filter((s) => s?.open && !busy.has(s.id) && canReceive(closing, s.id))
    .map((s) => ({ id: s.id, miles: miles(home, schoolPos(s.id)), kids: s.enrollment, capacity: s.capacity }))
    .sort((a, b) => a.miles - b.miles);
}

/** Draw purposes for closure decisions, apart from step.ts's. */
const D = {
  Rezone: 30,
  Receiver: 31,
  Follow: 32,
  NonFollower: 33,
  Away: 34,
  Crowd: 35,
  FollowSchool: 36,
};

/**
 * The nearest open zoned school serving `grade`, preferring one with a free seat when `counts` is
 * given. When no open school serves the grade, the nearest open school.
 */
export function nearestOpen(
  pos: Point,
  grade: number,
  closed: { has(school: SchoolId): boolean },
  exclude: ReadonlySet<SchoolId> = new Set(),
  counts?: ReadonlyMap<SchoolId, number>,
): SchoolId {
  const scan = (anyGrade: boolean) => {
    let best: SchoolId | null = null;
    let bestScore = Infinity;
    for (const i of ZONED) {
      const id = i.data.id;
      if ((!anyGrade && (grade < i.lo || grade > i.hi)) || closed.has(id) || exclude.has(id)) continue;
      const full = counts !== undefined && (counts.get(id) ?? 0) >= (i.data.capacity ?? 0);
      const score = miles(pos, [i.data.x, i.data.y]) + (full ? 1e6 : 0);
      if (score < bestScore) [best, bestScore] = [id, score];
    }
    return best;
  };
  return (scan(false) ?? scan(true))!;
}

function pickShare(receivers: Closure['receivers'], u: number): SchoolId {
  let sum = 0;
  for (const r of receivers) if (u < (sum += r.share)) return r.school;
  return receivers[receivers.length - 1].school;
}

/** Follows closed schools to their receivers, or the nearest open school when none serves the grade. */
export function resolveSchool(
  closed: ReadonlyMap<SchoolId, ClosedSchool>,
  school: SchoolId,
  grade: number,
  pos: Point,
  u: number,
): SchoolId {
  while (closed.has(school)) {
    const serving = receiversFor(closed.get(school)!, grade);
    school = serving.length ? pickShare(serving, u) : nearestOpen(pos, grade, closed);
  }
  return school;
}

/** A household's stable dice for which receiver its closed zone sends it to. */
export function rezoneDraw(seed: number, id: number): number {
  return draw(seed, id, 0, D.Rezone);
}

/** The receiver is URM without a full retrofit and the closed school is not. */
export function isRiskier(receiver: SchoolId, closed: SchoolId): boolean {
  const risky = (id: SchoolId) => {
    const d = SCHOOL_INFO.get(id)!.data;
    return d.isUrm && d.seismicRetrofitStatus !== 'full';
  };
  return risky(receiver) && !risky(closed);
}

export function followFactors(h: Household, closure: Closure, target: SchoolId): FollowFactors {
  return {
    miles: miles(h.pos, schoolPos(target)),
    barrier: acrossWillamette(h.pos, schoolPos(target)),
    riskier: isRiskier(target, closure.school),
    movedBefore: (h.forcedMoves ?? 0) > 0,
    loyalty: h.loyalty,
    exitCapacity: h.exitCapacity,
    wholeClasses: closure.receivers.length === 1,
  };
}

/** model.followRate: each school's follow rate sits within ±5 points of the card. */
export function schoolFollowOffset(seed: number, school: SchoolId): number {
  return (draw(seed, hashString(school), 0, D.FollowSchool) - 0.5) * 2 * M.followSchoolSpread;
}

/** A closed school's kid at its fall decision. `next` is already a grade older. */
export interface Mover {
  before: Household;
  next: Household;
  closure: ClosedSchool;
  /** Where the kid goes if no receiver serves its grade. */
  fallback: SchoolId;
  region: { kids: number; leavers: number } | null;
}

export interface ClosureTally {
  school: SchoolId;
  kids: number;
  receivers: Record<SchoolId, number>;
  otherPps: number;
  left: number;
}

/**
 * Fall after closures take effect: each mover follows to a receiver or goes to another PPS school,
 * a charter or out of PPS. Receivers over the crowding line send their newest arrivals to decide
 * again. Movers' `next` has no school yet, so counts come from the others.
 */
export function decideClosures(args: {
  seed: number;
  year: number;
  followRate: number;
  closed: ReadonlyMap<SchoolId, ClosedSchool>;
  closing: ClosedSchool[];
  movers: Mover[];
  households: Household[];
  flows: Flows;
}): ClosureTally[] {
  const { seed, year, closed, movers, flows } = args;
  if (args.closing.length === 0) return [];
  const tallies = new Map(
    args.closing.map((c) => [c.school, { school: c.school, kids: 0, receivers: {}, otherPps: 0, left: 0 } as ClosureTally]),
  );
  const counts = new Map<SchoolId, number>();
  for (const h of args.households) if (h.school !== null) counts.set(h.school, (counts.get(h.school) ?? 0) + 1);
  const add = (id: SchoolId, n: number) => counts.set(id, (counts.get(id) ?? 0) + n);

  const leave = (m: Mover, choice: 'charter' | 'left') => {
    m.next.school = null;
    m.next.status = 'left';
    m.next.leftThisYear = true;
    if (choice === 'left' && draw(seed, year, m.before.id, D.Away) < M.awayShare) m.next.movedAway = true;
    flows.leftPps++;
    if (m.region) m.region.leavers++;
    tallies.get(m.closure.school)!.left++;
  };
  const otherPps = (m: Mover, exclude: Set<SchoolId>) => {
    const school = nearestOpen(m.next.pos, gradeOf(m.next), closed, exclude, counts);
    m.next.school = school;
    add(school, 1);
    tallies.get(m.closure.school)!.otherPps++;
  };

  const arrivals = new Map<SchoolId, Mover[]>();
  for (const m of movers) {
    const { before, next, closure } = m;
    const t = tallies.get(closure.school)!;
    t.kids++;
    next.movedFrom = closure.school;
    next.forcedMoves = (before.forcedMoves ?? 0) + 1;
    next.fundedAs = before.fundedAs ?? closure.school;
    const serving = receiversFor(closure, gradeOf(next));
    const target = serving.length ? pickShare(serving, draw(seed, year, before.id, D.Receiver)) : m.fallback;
    const p = followChance(args.followRate + schoolFollowOffset(seed, closure.school), followFactors(before, closure, target));
    if (draw(seed, year, before.id, D.Follow) >= p) {
      // model.nonFollowers
      const choice = nonFollowerChoice(draw(seed, year, before.id, D.NonFollower));
      if (choice !== 'otherPps') {
        leave(m, choice);
        continue;
      }
      next.status = 'moved';
      flows.movedWithinPps++;
      otherPps(m, new Set([closure.school, ...closure.receivers.map((r) => r.school)]));
      continue;
    }
    next.school = target;
    next.status = 'moved';
    add(target, 1);
    flows.movedWithinPps++;
    if (serving.length) {
      t.receivers[target] = (t.receivers[target] ?? 0) + 1;
      arrivals.set(target, [...(arrivals.get(target) ?? []), m]);
    } else t.otherPps++;
  }

  // model.crowding: kids past the line move on to the nearest PPS school with room.
  for (const [school, arrived] of arrivals) {
    const line = Math.floor(M.crowdingLine * (SCHOOL_INFO.get(school)!.data.capacity ?? Infinity));
    const over = (counts.get(school) ?? 0) - line;
    if (over <= 0) continue;
    const decide = arrived
      .map((m) => ({ m, u: draw(seed, year, m.before.id, D.Crowd) }))
      .sort((a, b) => a.u - b.u)
      .slice(0, over);
    for (const { m } of decide) {
      add(school, -1);
      tallies.get(m.closure.school)!.receivers[school]--;
      otherPps(m, new Set([m.closure.school, school]));
    }
  }
  return [...tallies.values()];
}

/** The report's "where kids went" for this year's closures, as ranges. */
export function closureOutcomes(tallies: ClosureTally[], closing: ClosedSchool[]): ClosureOutcome[] {
  return closing.map((c) => {
    const t = tallies.find((x) => x.school === c.school)!;
    const actual = modeledRange(t.kids - t.left);
    return {
      school: c.school,
      kids: modeledRange(t.kids),
      receivers: c.receivers.map((r) => ({ school: r.school, kids: modeledRange(t.receivers[r.school] ?? 0) })),
      otherPps: modeledRange(t.otherPps),
      leftPps: modeledRange(t.left),
      ...(c.guess === undefined
        ? {}
        : { guess: { stayInPps: c.guess, actual, hit: c.guess >= actual.lo && c.guess <= actual.hi } }),
    };
  });
}
