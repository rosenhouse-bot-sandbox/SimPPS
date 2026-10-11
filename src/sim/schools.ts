import { classesFor, cutCreep, stateWeight } from './budget';
import { gradeOf, MAX_GRADE } from './model';
import { SCHOOL_INFO } from './population';
import type { ClosedSchool, Dials, GameState, Household, SchoolState } from './types';

/** Each school's kids and homerooms. Cuts remove `homeroomsCut` homerooms across schools. */
export function buildSchools(
  households: Household[],
  classSize: number,
  homeroomsCut = 0,
  closed: ClosedSchool[] = [],
): Record<string, SchoolState> {
  const schools: Record<string, SchoolState> = {};
  for (const [id, info] of SCHOOL_INFO)
    schools[id] = {
      id,
      open: true,
      enrollment: info.highSchoolers,
      byGrade: new Array<number>(MAX_GRADE + 1).fill(0),
      capacity: info.data.capacity ?? 0,
      stateRevenue: info.highSchoolers * stateWeight(id),
      homerooms: 0,
      blendedHomerooms: 0,
    };
  // High schoolers at a closed school move to neighborhood high schools, outside the simulation.
  for (const c of closed)
    Object.assign(schools[c.school], { open: false, enrollment: 0, stateRevenue: 0, closed: { year: c.year, building: c.building } });
  for (const h of households) {
    if (h.school === null) continue;
    const s = schools[h.school];
    s.enrollment++;
    s.byGrade[gradeOf(h)]++;
    s.stateRevenue += stateWeight(h.fundedAs ?? h.school);
  }
  const creep = cutCreep(schools, classSize, homeroomsCut);
  for (const s of Object.values(schools)) {
    const c = classesFor(s.byGrade, classSize, creep);
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
  for (const s of Object.values(state.schools)) {
    const { isUrm, seismicRetrofitStatus } = SCHOOL_INFO.get(s.id)!.data;
    if (isUrm && seismicRetrofitStatus !== 'full') kidsInUrm += s.enrollment;
  }
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
