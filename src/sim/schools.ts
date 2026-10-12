import { classesFor, cutCreep, stateWeight } from './budget';
import { classroomsDial, gradeOf, M, MAX_GRADE } from './model';
import { SCHOOL_INFO } from './population';
import { programsAt } from './programs';
import { newBusRiders, walkK5 } from './walk';
import type { ClosedSchool, ConvertedSchool, Dials, GameState, Household, ProgramMove, SchoolState } from './types';

/** Each school's kids and homerooms. Cuts remove `homeroomsCut` homerooms across schools. */
export function buildSchools(
  households: Household[],
  classSize: number,
  homeroomsCut = 0,
  closed: ClosedSchool[] = [],
  converted: ConvertedSchool[] = [],
  programMoves: readonly ProgramMove[] = [],
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
      k5Homerooms: 0,
      blendedHomerooms: 0,
    };
  // High schoolers at a closed school move to neighborhood high schools, outside the simulation.
  for (const c of closed)
    Object.assign(schools[c.school], { open: false, enrollment: 0, stateRevenue: 0, closed: { year: c.year, building: c.building } });
  // model.gradeSpan
  for (const c of converted) {
    const s = schools[c.school];
    Object.assign(s, { capacity: s.capacity * M.conversionCapacity, converted: { year: c.year, to: c.to } });
  }
  for (const [id, programs] of programsAt(programMoves))
    if (programs.size && schools[id].open) schools[id].dli = Object.fromEntries([...programs].map((p) => [p, 0]));
  for (const h of households) {
    if (h.school === null) continue;
    const s = schools[h.school];
    if (h.program && s.dli?.[h.program] !== undefined) s.dli[h.program]!++;
    s.enrollment++;
    s.byGrade[gradeOf(h)]++;
    s.stateRevenue += stateWeight(h.fundedAs ?? h.school);
  }
  const creep = cutCreep(schools, classSize, homeroomsCut);
  for (const s of Object.values(schools)) {
    const c = classesFor(s.byGrade, classSize, creep);
    s.homerooms = c.homerooms;
    s.k5Homerooms = classesFor(s.byGrade.slice(0, 6), classSize, creep).homerooms;
    s.blendedHomerooms = c.blended;
  }
  return schools;
}

export function computeDials(state: Pick<GameState, 'households' | 'schools' | 'budget'>, positionsCut: number, trust: number): Dials {
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
  let k5Kids = 0;
  let k5Rooms = 0;
  let classrooms = 0;
  for (const s of Object.values(state.schools)) {
    if (s.open) {
      const k5 = s.byGrade.slice(0, 6).reduce((a, n) => a + n, 0);
      const middle = s.byGrade.slice(6).reduce((a, n) => a + n, 0);
      k5Kids += k5;
      k5Rooms += s.k5Homerooms;
      // model.classrooms
      if (k5 >= M.classroomsK5 && s.blendedHomerooms === 0) classrooms += k5;
      if (middle >= M.classroomsMiddle) classrooms += middle;
    }
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
    walkK5: walkK5(state.households),
    newBusRiders: newBusRiders(state.households),
    trust,
    k5Class: classroomsDial() ? classrooms : k5Rooms ? k5Kids / k5Rooms : 0,
  };
}
