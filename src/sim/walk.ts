import { schoolPos, miles } from './closures';
import { gradeOf, M } from './model';
import type { Household, Range, SchoolId } from './types';
import { defaultZone } from './zones';

/** model.walkLimit: miles past which a kid rides a bus to its zone school. */
export function walkLimit(grade: number): number {
  return grade <= 5 ? M.walkLimitK5 : M.walkLimitMiddle;
}

/** Straight-line miles from home to a school. */
export function milesTo(h: Pick<Household, 'pos'>, school: SchoolId): number {
  return miles(h.pos, schoolPos(school));
}

/** The Walk dial: PPS K-5 kids within a mile of their school. */
export function walkK5(households: readonly Household[]): number {
  let n = 0;
  for (const h of households) if (h.school !== null && gradeOf(h) <= 5 && milesTo(h, h.school) <= M.walkDialMiles) n++;
  return n;
}

/** A kid at its zone school past the walk limit whose zone before any change was within it. */
export function ridesNewBus(h: Pick<Household, 'pos' | 'cell'>, grade: number, school: SchoolId | null, zone: SchoolId): boolean {
  if (school !== zone) return false;
  const limit = walkLimit(grade);
  if (milesTo(h, school) <= limit) return false;
  const before = defaultZone(h, grade);
  return before !== school && milesTo(h, before) <= limit;
}

export function newBusRiders(households: readonly Household[]): number {
  let n = 0;
  for (const h of households) if (ridesNewBus(h, gradeOf(h), h.school, h.zoneSchool)) n++;
  return n;
}

const mid = (r: Range) => (r.lo + r.hi) / 2;

/** model.busing: a year of new riders in 2027-28 dollars. The budget books the middle. */
export function busingCost(riders: number): number {
  return riders * mid(M.busRider);
}

/** model.busReimbursement: what the state repays a year after the district pays for buses. */
export function busReimbursement(paidLastYear: number): number {
  return paidLastYear * mid(M.busReimbursed);
}
