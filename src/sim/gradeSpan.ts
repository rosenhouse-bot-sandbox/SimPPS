import { effectiveClosures, miles, normalizeClosures, schoolPos, withArrivals } from './closures';
import { MAX_GRADE } from './model';
import { SCHOOL_INFO } from './population';
import { modeledRange } from './range';
import type { RezoneTally } from './boundaries';
import type { Closure, ConversionOutcome, GameState, GradeSpanChange, Policy, SchoolId, SchoolState, ZoneMap } from './types';

/** Schools a grade can't attend. A Map or Set of closed schools ignores the grade. */
export interface Shut {
  has(school: SchoolId, grade?: number): boolean;
}

/** Closed schools, and converted schools for grades 6-8. */
export function shutTo(closed: { has(school: SchoolId): boolean }, converted: ReadonlySet<SchoolId>): Shut {
  return { has: (school, grade = 0) => closed.has(school) || (grade >= 6 && converted.has(school)) };
}

/** Schools a grade-span change has made K-5. */
export function convertedIn(schools: Record<SchoolId, SchoolState>): { has(school: SchoolId): boolean } {
  return { has: (school) => !!schools[school]?.converted };
}

/** The last grade a school serves. */
export function topGrade(school: SchoolId, converted: { has(school: SchoolId): boolean }): number {
  return converted.has(school) ? 5 : SCHOOL_INFO.get(school)!.hi;
}

function isK8(id: SchoolId): boolean {
  const i = SCHOOL_INFO.get(id);
  return !!i && i.lo === 0 && i.hi === MAX_GRADE && i.elemZone >= 0;
}

function isZonedMiddle(id: SchoolId): boolean {
  const i = SCHOOL_INFO.get(id);
  return !!i && i.lo === 6 && i.middleZone >= 0;
}

const MIDDLE_SCHOOLS = [...SCHOOL_INFO.keys()].filter(isZonedMiddle);

/** An open neighborhood K-8 that still serves grades 6-8. */
export function canConvert(schools: Record<SchoolId, SchoolState>, school: SchoolId): boolean {
  const s = schools[school];
  return !!s?.open && !s.converted && isK8(school);
}

/** Open zoned middle schools the plan doesn't close, nearest the K-8 first. */
export function middleSchoolCandidates(
  schools: Record<SchoolId, SchoolState>,
  school: SchoolId,
  closures: readonly Closure[],
): { id: SchoolId; miles: number; kids: number; capacity: number }[] {
  const home = schoolPos(school);
  const closing = new Set(closures.map((c) => c.school));
  return MIDDLE_SCHOOLS.map((id) => schools[id])
    .filter((s) => s?.open && !closing.has(s.id))
    .map((s) => ({ id: s.id, miles: miles(home, schoolPos(s.id)), kids: s.enrollment, capacity: s.capacity }))
    .sort((a, b) => a.miles - b.miles);
}

/** Keeps one change per neighborhood K-8 into a zoned middle school. Neither may close in the plan. */
export function normalizeGradeChanges(changes: readonly GradeSpanChange[], closures: readonly Closure[]): GradeSpanChange[] {
  const closing = new Set(closures.map((c) => c.school));
  const seen = new Set<SchoolId>();
  return changes.flatMap(({ school, to }) =>
    isK8(school) && isZonedMiddle(to) && !closing.has(school) && !closing.has(to) && !seen.has(school) && seen.add(school)
      ? [{ school, to }]
      : [],
  );
}

/** Changes that can happen this summer. */
export function effectiveGradeChanges(schools: Record<SchoolId, SchoolState>, changes: readonly GradeSpanChange[]): GradeSpanChange[] {
  return changes.filter((g) => canConvert(schools, g.school) && schools[g.to]?.open);
}

/** Converted schools' middle-zone blocks feed their receivers. */
export function convertZones(zones: ZoneMap, converted: readonly GradeSpanChange[]): ZoneMap {
  const to = new Map(converted.map((c) => [c.school, c.to]));
  if (!zones.middle.some((s) => to.has(s))) return zones;
  return { ...zones, middle: zones.middle.map((s) => to.get(s) ?? s) };
}

/** Arithmetic for a grade-span change. It never predicts family choices. */
export interface ConversionChip {
  /** Rising 7th and 8th graders, who must choose next fall. */
  kidsMoving: number;
  /** The receiver's kids and seats if the plan's closure kids and every rising 6th to 8th grader sent there arrive. */
  seats: { kids: number; capacity: number };
}

const risingMiddle = (s: SchoolState) => s.byGrade.slice(5, MAX_GRADE).reduce((a, n) => a + n, 0);

/** `plan` holds the closures and other grade-span changes that also send kids to the receiver. */
export function conversionChip(state: Pick<GameState, 'schools'>, change: GradeSpanChange, plan: Policy): ConversionChip {
  const schools = effectiveClosures(state.schools, normalizeClosures(plan.closures)).reduce(withArrivals, state.schools);
  const others = (plan.gradeChanges ?? []).filter((g) => g.to === change.to && g.school !== change.school);
  const from = state.schools[change.school];
  const to = schools[change.to];
  const kids = to.enrollment + [from, ...others.map((g) => state.schools[g.school])].reduce((a, s) => a + risingMiddle(s), 0);
  return { kidsMoving: from.byGrade[6] + from.byGrade[7], seats: { kids, capacity: to.capacity } };
}

export interface ConversionTally extends RezoneTally {
  school: SchoolId;
  to: SchoolId;
}

/** The report's "where kids went" for this year's conversions, as ranges. */
export function conversionOutcomes(tallies: readonly ConversionTally[]): ConversionOutcome[] {
  return tallies.map((t) => ({
    school: t.school,
    to: t.to,
    kids: modeledRange(t.kids),
    receiver: modeledRange(t.arrived),
    otherPps: modeledRange(t.otherPps),
    leftPps: modeledRange(t.left),
  }));
}
