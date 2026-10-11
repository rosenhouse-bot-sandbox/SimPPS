import { classesFor } from './budget';
import { gradeOf, MAX_GRADE } from './model';
import { SCHOOL_INFO } from './population';
import type { Dials, GameState, Household, SchoolState } from './types';

export function buildSchools(households: Household[], classSize: number): Record<string, SchoolState> {
  const schools: Record<string, SchoolState> = {};
  for (const [id, info] of SCHOOL_INFO)
    schools[id] = {
      id,
      open: true,
      enrollment: 0,
      byGrade: new Array<number>(MAX_GRADE + 1).fill(0),
      capacity: info.data.capacity ?? 0,
      homerooms: 0,
      blendedHomerooms: 0,
    };
  for (const h of households) {
    if (h.school === null) continue;
    const s = schools[h.school];
    s.enrollment++;
    s.byGrade[gradeOf(h)]++;
  }
  for (const s of Object.values(schools)) {
    const c = classesFor(s.byGrade, classSize);
    s.homerooms = c.homerooms;
    s.blendedHomerooms = c.blended;
  }
  return schools;
}

export function computeDials(state: Pick<GameState, 'households' | 'schools' | 'budget'>, positionsCut: number): Dials {
  let residents = 0;
  let inPps = 0;
  let kResidents = 0;
  let kInPps = 0;
  for (const h of state.households) {
    if (h.movedAway) continue;
    residents++;
    const k = gradeOf(h) === 0;
    if (k) kResidents++;
    if (h.school === null) continue;
    inPps++;
    if (k) kInPps++;
  }
  let kidsInUrm = 0;
  for (const s of Object.values(state.schools)) if (SCHOOL_INFO.get(s.id)!.data.isUrm) kidsInUrm += s.enrollment;
  return {
    kids: inPps,
    capture: inPps / residents,
    kindergartenCapture: kInPps / kResidents,
    gap: state.budget.gap,
    positionsCut,
    reservePct: state.budget.reservePct,
    kidsInUrm,
  };
}
