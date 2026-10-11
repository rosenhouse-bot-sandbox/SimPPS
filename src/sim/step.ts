import { clamp } from '../clamp';
import { ZONES, type Point } from '../data';
import { classesFor, computeBudget, costIndex, cutCreep, legislatureVotes, stateFundingGrowth, stateFundingLevel } from './budget';
import { samplePoint, ZoneIndex } from './geo';
import { gradeOf, M, MAX_GRADE, oneKid } from './model';
import {
  CITYWIDE_INTAKE,
  ELEM,
  exitCapacityFor,
  middleZoneSchool,
  pick,
  SCHOOL_INFO,
  voiceFor,
} from './population';
import { draw, stream } from './rng';
import { closuresTakingEffect, decideClosures, rezoneDraw, resolveSchool, type ClosureTally, type Mover } from './closures';
import { buildSchools, computeDials } from './schools';
import type {
  Budget,
  ClosedSchool,
  Flows,
  GameState,
  Household,
  Policy,
  SchoolChoice,
  SchoolId,
  SimMemory,
} from './types';

const HIGH = new ZoneIndex(ZONES.high);
/** Neutral names for high school zones, so headlines never name a school. */
const REGION: Record<string, string> = {
  Cleveland: 'Inner Southeast',
  Franklin: 'Outer Southeast',
  Grant: 'Northeast',
  'Ida B. Wells': 'Southwest',
  'Jefferson / Grant': 'Northeast',
  'Jefferson / McDaniel': 'Outer Northeast',
  'Jefferson / Roosevelt': 'North',
  Lincoln: 'Northwest',
  McDaniel: 'Outer Northeast',
  Roosevelt: 'North',
};

function regionOf(pos: Point): string | null {
  const z = HIGH.find(pos);
  return z >= 0 ? REGION[ZONES.high[z].name] : null;
}

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
  Citywide: 16,
};

/** PPS kids at the start of the year and those who left, by region. */
export type RegionTally = Map<string, { kids: number; leavers: number }>;

export interface YearFacts {
  plan: Budget;
  reserveDraw: number;
  autoCuts: number;
  midYearCuts: number;
  kResidents: number;
  kEnrolled: number;
  graduates: number;
  flows: Flows;
  regions: RegionTally;
  k5Homerooms: number;
  /** Homerooms that cuts have removed by October. */
  homeroomsCut: number;
  blended: number;
  crowded: number;
  /** The Legislature's growth for the biennium starting this fall; null in even years. */
  stateFundingGrowth: number | null;
  /** Closures that took effect this summer. */
  closing: ClosedSchool[];
  closures: ClosureTally[];
}

/** Kindergarten capture by fall year: 74% in 2025 rising to the 79% PSU assumes by 2028. */
export function kCaptureTrend(year: number): number {
  return M.kCapture2025 + (M.kCapture2028 - M.kCapture2025) * clamp((year - 2025) / 3, 0, 1);
}

/** Extra yearly exit from a worse year: class size above 24 and positions cut. At most 1 point. */
export function worseYear(classSize: number, positionsCut: number): number {
  return clamp(
    (classSize - 24) * M.classSizeExitPerKid + (positionsCut / 100) * M.cutsExitPer100Positions,
    -M.worseYearCap / 2,
    M.worseYearCap,
  );
}

/** model.movingRoll: the chance a PPS household leaves this fall. */
export function leaveChance(h: Household, schoolChange: boolean, worse: number): number {
  const base = schoolChange ? M.grade6Exit : M.leaveRate * (0.7 + 0.6 * h.exitCapacity);
  return base + worse * (1.25 - 0.5 * h.loyalty);
}

export interface FamilyYear {
  households: Household[];
  nextId: number;
  kResidents: number;
  kEnrolled: number;
  graduates: number;
  flows: Flows;
  regions: RegionTally;
  closures: ClosureTally[];
}

/** Closures in force this fall and the hidden cards that steer them. */
export interface ClosureYear {
  /** Every closure in force, this year's included. */
  closed: ClosedSchool[];
  cards: SimMemory['cards'];
}

/** Spring to fall of `year`: kindergartners choose, 8th graders leave and everyone else may move. */
export function familiesDecide(
  mem: Pick<SimMemory, 'seedHash' | 'nextId' | 'kChoice' | 'msMix' | 'zoneKeep' | 'kCohort' | 'kCapture'>,
  before: Household[],
  year: number,
  classSize: number,
  positionsCut: number,
  closures: ClosureYear = { closed: [], cards: { followRate: 1, closedZoneCaptureDrop: 0 } },
): FamilyYear {
  const seed = mem.seedHash;
  const closed = new Map(closures.closed.map((c) => [c.school, c]));
  const closing = closures.closed.filter((c) => c.year === year);
  const closingNow = new Set(closing.map((c) => c.school));
  const resolve = (school: SchoolId, grade: number, h: Pick<Household, 'id' | 'pos'>) =>
    closed.has(school) ? resolveSchool(closed, school, grade, h.pos, rezoneDraw(seed, h.id)) : school;

  // Spring: kindergarten entrants choose.
  const households: Household[] = [];
  let nextId = mem.nextId;
  let kResidents = 0;
  let kEnrolled = 0;
  const entrantBump = Math.max(0, worseYear(classSize, 0));
  const capture = kCaptureTrend(year);
  const cohortScale = (1 + M.cohortTrend) ** (year - 2025);
  ZONES.elementary.forEach((zone, z) => {
    const expected = mem.kCohort[z] * cohortScale;
    const n = Math.floor(expected) + (draw(seed, year, z, D.EntrantCount) < expected % 1 ? 1 : 0);
    // model.closedZoneCapture
    const closedZoneDrop = closed.has(zone.school) ? closures.cards.closedZoneCaptureDrop : 0;
    const zoneCapture = clamp(mem.kCapture[z] + capture - M.kCapture2025 - entrantBump - closedZoneDrop, 0, 0.98);
    for (let k = 0; k < n; k++) {
      const id = nextId++;
      const rand = stream(Math.floor(draw(seed, id, D.EntrantHome) * 0x100000000));
      const joins = draw(seed, year, id, D.EntrantJoins) < zoneCapture;
      const exitCapacity = exitCapacityFor(zone.school, rand());
      kResidents++;
      if (joins) kEnrolled++;
      const pos = samplePoint(zone, rand);
      households.push({
        id,
        pos,
        kids: oneKid(0),
        zoneSchool: resolve(zone.school, 0, { id, pos }),
        ...(closed.has(zone.school) ? { fundedAs: zone.school } : {}),
        school: joins ? resolve(pick(mem.kChoice[z], draw(seed, year, id, D.EntrantSchool)), 0, { id, pos }) : null,
        exitCapacity,
        loyalty: clamp(mem.zoneKeep[z] + (rand() - 0.5) * 0.2, 0, 1),
        voice: voiceFor(exitCapacity, rand()),
        status: joins ? 'stayed' : 'left',
      });
    }
  });

  // Summer: 8th graders leave. Fall: everyone else may move.
  const bumpK5 = worseYear(classSize, positionsCut);
  const bumpOther = worseYear(24, positionsCut);
  const flows: Flows = { stayed: 0, movedWithinPps: 0, leftPps: 0, cameBack: 0, enteredK: kEnrolled, graduated: 0 };
  const regions: RegionTally = new Map();
  const movers: Mover[] = [];
  let graduates = 0;
  for (const h of before) {
    if (h.movedAway) continue;
    const g = gradeOf(h);
    if (g === MAX_GRADE) {
      if (h.school !== null) graduates++;
      continue;
    }
    const ng = g + 1;
    const next: Household = { ...h, kids: oneKid(ng) };
    delete next.movedAway;
    delete next.leftThisYear;
    if (next.movedFrom) delete next.movedFrom;
    const feeder = resolve(ng === 6 ? middleZoneSchool(h.pos, h.zoneSchool) : h.zoneSchool, ng, h);
    next.zoneSchool = feeder;
    if (h.school !== null) {
      const region = countKid(regions, h.pos);
      if (closingNow.has(h.school) && ng <= SCHOOL_INFO.get(h.school)!.hi) {
        // Placeholders until decideClosures, so nothing else counts or picks the mover.
        next.school = null;
        next.status = 'moved';
        movers.push({ before: h, next, closure: closed.get(h.school)!, fallback: feeder, region });
        households.push(next);
        continue;
      }
      const transition = ng > SCHOOL_INFO.get(h.school)!.hi;
      if (draw(seed, year, h.id, D.Leave) < leaveChance(h, transition, ng <= 5 ? bumpK5 : bumpOther)) {
        next.school = null;
        next.status = 'left';
        next.leftThisYear = true;
        if (draw(seed, year, h.id, D.Away) < M.awayShare) next.movedAway = true;
        flows.leftPps++;
        if (region) region.leavers++;
      } else if (transition) {
        next.school =
          draw(seed, year, h.id, D.Feeder) < M.feederShare
            ? feeder
            : resolve(pick(mem.msMix, draw(seed, year, h.id, D.MiddleSchool)), ng, h);
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
        next.school = resolve(returnSchool(mem.kChoice, h, ng, feeder, draw(seed, year, h.id, D.ReturnSchool)), ng, h);
        next.status = 'returned';
        flows.cameBack++;
      }
    }
    households.push(next);
  }
  for (const { school, grade, kids } of CITYWIDE_INTAKE) {
    if (closed.has(school)) continue;
    const picked = households
      .filter((h) => h.status === 'stayed' && h.school !== school && gradeOf(h) === grade)
      .map((h) => ({ h, u: draw(seed, year, h.id, D.Citywide) }))
      .sort((a, b) => a.u - b.u)
      .slice(0, kids);
    for (const { h } of picked) {
      h.school = school;
      h.status = 'moved';
      flows.stayed--;
      flows.movedWithinPps++;
    }
  }
  flows.graduated = graduates;
  const closureTallies = decideClosures({
    seed,
    year,
    followRate: closures.cards.followRate,
    closed,
    closing,
    movers,
    households,
    flows,
  });
  return { households, nextId, kResidents, kEnrolled, graduates, flows, regions, closures: closureTallies };
}

export function stepYear(state: GameState, policy: Policy): { next: GameState; facts: YearFacts } {
  const mem = state.sim!;
  const year = state.year;
  const index = costIndex(year);
  const closing = closuresTakingEffect(state.schools, policy.closures, policy.k5ClassSize, year);
  const closed = [...mem.closed, ...closing];

  // June: the budget closes.
  const plan = computeBudget({
    year,
    schools: state.schools,
    policy,
    reserves: state.budget.reserves,
    priorSpending: mem.spending,
    cumulativeCuts: mem.cumulativeCuts,
    homeroomsCut: mem.homeroomsCut,
    restRevenue: mem.restRevenue,
    restCost: mem.restCost,
    stateFunding: stateFundingLevel(mem.seedHash, year, 'june'),
    closed: mem.closed,
  });
  const autoCuts = plan.autoCutPositions;
  const position = M.positionCost * index;
  const classroomShare = -plan.lines.find((l) => l.key === 'homerooms')!.amount / (plan.spending + autoCuts * position);

  const { households, nextId, kResidents, kEnrolled, graduates, flows, regions, closures } = familiesDecide(
    mem,
    state.households,
    year,
    policy.k5ClassSize,
    autoCuts,
    { closed, cards: mem.cards },
  );

  // October: classes form, short the homerooms that cuts removed.
  const octoberCut = mem.homeroomsCut + Math.round(autoCuts * classroomShare);
  const schools = buildSchools(households, policy.k5ClassSize, octoberCut, closed);
  const creep = cutCreep(schools, policy.k5ClassSize, octoberCut);
  let k5Homerooms = 0;
  let blended = 0;
  let crowded = 0;
  for (const s of Object.values(schools)) {
    k5Homerooms += classesFor(s.byGrade.slice(0, 6), policy.k5ClassSize, creep).homerooms;
    blended += s.blendedHomerooms;
    if (s.capacity > 0 && s.enrollment > s.capacity) crowded++;
  }

  // Winter: below 3% reserves, mid-year cuts save half a year's pay.
  const midYearCuts = plan.midYearCuts;
  const midYearSavings = (midYearCuts * position) / 2;
  const homeroomsCut = octoberCut + Math.round(midYearCuts * classroomShare);
  const reserves = plan.reservesAfter + midYearSavings;

  const nextPolicy: Policy = { ...policy, reserveDraw: 0, closures: [] };
  const cumulativeCuts = mem.cumulativeCuts + autoCuts + midYearCuts;
  const spending = plan.spending - midYearSavings;
  const sim = { ...mem, nextId, cumulativeCuts, homeroomsCut, spending, closed, ghost: undefined };
  const budget = computeBudget({
    year: year + 1,
    schools,
    policy: nextPolicy,
    reserves,
    priorSpending: spending,
    cumulativeCuts,
    homeroomsCut,
    restRevenue: mem.restRevenue,
    restCost: mem.restCost,
    stateFunding: stateFundingLevel(mem.seedHash, year + 1, 'january'),
    closed,
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
      reserveDraw: plan.reserveDraw,
      autoCuts,
      midYearCuts,
      kResidents,
      kEnrolled,
      graduates,
      flows,
      regions,
      k5Homerooms,
      homeroomsCut: octoberCut,
      blended,
      crowded,
      stateFundingGrowth: legislatureVotes(year) ? stateFundingGrowth(mem.seedHash, year) : null,
      closing,
      closures,
    },
  };
}

function countKid(regions: RegionTally, pos: Point): { kids: number; leavers: number } | null {
  const name = regionOf(pos);
  if (!name) return null;
  let r = regions.get(name);
  if (!r) regions.set(name, (r = { kids: 0, leavers: 0 }));
  r.kids++;
  return r;
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
