import { miles, schoolPos } from './closures';
import { gradeOf, MAX_GRADE } from './model';
import { SCHOOL_INFO } from './population';
import { modeledRange } from './range';
import type { RezoneTally } from './boundaries';
import type { Closure, ConversionOutcome, GameState, GradeSpanChange, SchoolId, SchoolState, ZoneMap } from './types';

/** Schools a grade can't attend. A Map or Set of closed schools ignores the grade. */
export interface Shut {
  has(school: SchoolId, grade?: number): boolean;
}

/** Closed schools, and converted schools for grades 6-8. */
export function shutTo(closed: { has(school: SchoolId): boolean }, converted: ReadonlySet<SchoolId>): Shut {
  return { has: (school, grade = 0) => closed.has(school) || (grade >= 6 && converted.has(school)) };
}

/** The last grade a school serves. */
export function topGrade(school: SchoolId, converted: ReadonlySet<SchoolId>): number {
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

/** Open zoned middle schools, nearest the K-8 first. */
export function middleSchoolCandidates(
  schools: Record<SchoolId, SchoolState>,
  school: SchoolId,
): { id: SchoolId; miles: number; kids: number; capacity: number }[] {
  const home = schoolPos(school);
  return MIDDLE_SCHOOLS.map((id) => schools[id])
    .filter((s) => s?.open)
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
  /** This year's 6th and 7th graders, who must choose next fall. */
  kidsMoving: number;
  /** The receiver's kids and seats if this year's 5th to 7th graders all arrive. */
  seats: { kids: number; capacity: number };
}

export function conversionChip(state: Pick<GameState, 'schools' | 'households'>, change: GradeSpanChange): ConversionChip {
  let kidsMoving = 0;
  let arriving = 0;
  for (const h of state.households) {
    if (h.school !== change.school) continue;
    const g = gradeOf(h);
    if (g >= 5 && g < MAX_GRADE) arriving++;
    if (g >= 6 && g < MAX_GRADE) kidsMoving++;
  }
  const to = state.schools[change.to];
  return { kidsMoving, seats: { kids: to.enrollment + arriving, capacity: to.capacity } };
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
    receiver: modeledRange(t.zoneSchool),
    otherPps: modeledRange(t.otherPps),
    leftPps: modeledRange(t.left),
  }));
}
