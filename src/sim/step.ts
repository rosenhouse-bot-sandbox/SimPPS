import { ZONES } from '../data';
import { classesFor, computeBudget, costIndex, FIRST_YEAR, generalFund } from './budget';
import { samplePoint, ZoneIndex } from './geo';
import { gradeOf, M, MAX_GRADE, oneKid } from './model';
import {
  clamp,
  ELEM,
  exitCapacityFor,
  middleZoneSchool,
  pick,
  SCHOOL_INFO,
  voiceFor,
} from './population';
import { draw, stream } from './rng';
import { buildSchools, computeDials } from './schools';
import type { Budget, Flows, GameState, Household, Policy, SchoolChoice, SchoolId } from './types';

const HIGH = new ZoneIndex(ZONES.high);
const ELEM_ZONE_OF = new Map(ZONES.elementary.map((z, i) => [z.school, i]));

/** Draw purposes, so each decision has its own dice. */
const D = {
  EntrantCount: 1,
  EntrantHome: 2,
  EntrantJoins: 3,
  EntrantSchool: 4,
  Leave: 10,
  Away: 11,
  Feeder: 12,
  MiddleSchool: 13,
  Return: 14,
  ReturnSchool: 15,
};

export interface YearFacts {
  plan: Budget;
  reserveDraw: number;
  autoCuts: number;
  midYearCuts: number;
  kResidents: number;
  kEnrolled: number;
  graduates: number;
  flows: Flows;
  leaversByRegion: Map<string, number>;
  k5Homerooms: number;
  blended: number;
  crowded: number;
}

/** Kindergarten capture trend: 74% in fall 2025 to 79% by 2028 (PSU). Step t plays fall 2026 + t. */
export function kCaptureTrend(t: number): number {
  return M.kCapture2025 + (M.kCapture2028 - M.kCapture2025) * Math.min(1, (t + 1) / 3);
}

/** Extra yearly exit from a worse year: class size above 24 and positions cut. At most 1 point. */
export function worseYear(classSize: number, positionsCut: number): number {
  return clamp(
    (classSize - 24) * M.classSizeExitPerKid + (positionsCut / 100) * M.cutsExitPer100Positions,
    -M.worseYearCap / 2,
    M.worseYearCap,
  );
}

export function stepYear(state: GameState, policy: Policy): { next: GameState; facts: YearFacts } {
  const mem = state.sim!;
  const seed = mem.seedHash;
  const year = state.year;
  const t = year - FIRST_YEAR;
  const index = costIndex(year);

  // June: the budget closes.
  const plan = computeBudget({
    year,
    schools: state.schools,
    policy,
    reserves: state.budget.reserves,
    cumulativeCuts: mem.cumulativeCuts,
    restRevenue: mem.restRevenue,
    restCost: mem.restCost,
  });
  const reserveDraw = clamp(policy.reserveDraw, 0, plan.reserves);
  const autoCuts = plan.autoCutPositions;
  let reserves = plan.reserves - reserveDraw + Math.max(0, plan.gap + reserveDraw);

  // Spring: kindergarten entrants choose.
  const households: Household[] = [];
  let nextId = mem.nextId;
  let kResidents = 0;
  let kEnrolled = 0;
  const entrantBump = Math.max(0, worseYear(policy.k5ClassSize, 0));
  const capture = kCaptureTrend(t);
  const cohortScale = (1 + M.cohortTrend) ** (t + 1);
  ZONES.elementary.forEach((zone, z) => {
    const expected = mem.kCohort[z] * cohortScale;
    const n = Math.floor(expected) + (draw(seed, year, z, D.EntrantCount) < expected % 1 ? 1 : 0);
    const zoneCapture = clamp(mem.kCapture[z] + capture - M.kCapture2025 - entrantBump, 0, 0.98);
    for (let k = 0; k < n; k++) {
      const id = nextId++;
      const rand = stream(Math.floor(draw(seed, id, D.EntrantHome) * 0x100000000));
      const joins = draw(seed, year, id, D.EntrantJoins) < zoneCapture;
      const exitCapacity = exitCapacityFor(zone.school, rand());
      kResidents++;
      if (joins) kEnrolled++;
      households.push({
        id,
        pos: samplePoint(zone, rand),
        kids: oneKid(0),
        zoneSchool: zone.school,
        school: joins ? pick(mem.kChoice[z], draw(seed, year, id, D.EntrantSchool)) : null,
        exitCapacity,
        loyalty: clamp(mem.zoneKeep[z] + (rand() - 0.5) * 0.2, 0, 1),
        voice: voiceFor(exitCapacity, rand()),
        status: joins ? 'stayed' : 'left',
      });
    }
  });

  // Summer: 8th graders leave. Fall: everyone else may move.
  const bump = worseYear(policy.k5ClassSize, autoCuts);
  const flows: Flows = { stayed: 0, movedWithinPps: 0, leftPps: 0, cameBack: 0 };
  const leaversByRegion = new Map<string, number>();
  let graduates = 0;
  for (const h of state.households) {
    if (h.movedAway) continue;
    const g = gradeOf(h);
    if (g === MAX_GRADE) {
      if (h.school !== null) graduates++;
      continue;
    }
    const ng = g + 1;
    const next: Household = { ...h, kids: oneKid(ng) };
    delete next.movedAway;
    const feeder = ng === 6 ? middleZoneSchool(h.pos, h.zoneSchool) : h.zoneSchool;
    next.zoneSchool = feeder;
    if (h.school !== null) {
      const transition = ng > SCHOOL_INFO.get(h.school)!.hi;
      const base = transition ? M.grade6Exit : M.leaveRate * (0.7 + 0.6 * h.exitCapacity);
      const pLeave = base + bump * (1.25 - 0.5 * h.loyalty);
      if (draw(seed, year, h.id, D.Leave) < pLeave) {
        next.school = null;
        next.status = 'left';
        if (draw(seed, year, h.id, D.Away) < M.awayShare) next.movedAway = true;
        flows.leftPps++;
        const region = HIGH.find(h.pos);
        const name = region >= 0 ? ZONES.high[region].name : 'Outer';
        leaversByRegion.set(name, (leaversByRegion.get(name) ?? 0) + 1);
      } else if (transition) {
        next.school =
          draw(seed, year, h.id, D.Feeder) < M.feederShare
            ? feeder
            : pick(mem.msMix, draw(seed, year, h.id, D.MiddleSchool));
        next.status = next.school === feeder ? 'stayed' : 'moved';
        if (next.status === 'stayed') flows.stayed++;
        else flows.movedWithinPps++;
      } else {
        next.status = 'stayed';
        flows.stayed++;
      }
    } else {
      next.status = 'left';
      if (draw(seed, year, h.id, D.Away) < M.leaveRate * M.awayShare) {
        next.movedAway = true;
      } else if (draw(seed, year, h.id, D.Return) < (ng === 6 ? M.grade6Return : M.returnRate)) {
        next.school = returnSchool(mem.kChoice, h, ng, feeder, draw(seed, year, h.id, D.ReturnSchool));
        next.status = 'returned';
        flows.cameBack++;
      }
    }
    households.push(next);
  }

  // October: classes form.
  const schools = buildSchools(households, policy.k5ClassSize);
  let k5Homerooms = 0;
  let blended = 0;
  let crowded = 0;
  for (const s of Object.values(schools)) {
    k5Homerooms += classesFor(s.byGrade.slice(0, 6), policy.k5ClassSize).homerooms;
    blended += s.blendedHomerooms;
    if (s.capacity > 0 && s.enrollment > s.capacity) crowded++;
  }

  // Winter: below 3% reserves, mid-year cuts save half a year's pay.
  let midYearCuts = 0;
  const floor = M.midYearFloor * generalFund(year);
  if (reserves < floor) {
    const halfYear = (M.positionCost * index) / 2;
    midYearCuts = Math.ceil((floor - reserves) / halfYear);
    reserves += midYearCuts * halfYear;
  }

  const nextPolicy: Policy = { ...policy, reserveDraw: 0 };
  const cumulativeCuts = mem.cumulativeCuts + autoCuts + midYearCuts;
  const sim = { ...mem, nextId, cumulativeCuts, ghost: undefined };
  const budget = computeBudget({
    year: year + 1,
    schools,
    policy: nextPolicy,
    reserves,
    cumulativeCuts,
    restRevenue: mem.restRevenue,
    restCost: mem.restCost,
  });
  const nextState: GameState = {
    seed: state.seed,
    year: year + 1,
    schools,
    households,
    budget,
    dials: computeDials({ households, schools, budget }, autoCuts + midYearCuts),
    policy: nextPolicy,
    sim,
  };
  return {
    next: nextState,
    facts: {
      plan,
      reserveDraw: Math.min(reserveDraw, Math.max(0, -plan.gap)),
      autoCuts,
      midYearCuts,
      kResidents,
      kEnrolled,
      graduates,
      flows,
      leaversByRegion,
      k5Homerooms,
      blended,
      crowded,
    },
  };
}

function returnSchool(
  kChoice: SchoolChoice[],
  h: Household,
  grade: number,
  feeder: SchoolId,
  u: number,
): SchoolId {
  if (grade >= 6) return feeder;
  const z = ELEM_ZONE_OF.get(h.zoneSchool) ?? ELEM.find(h.pos);
  return pick(kChoice[z], u);
}
