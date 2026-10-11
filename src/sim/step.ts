import { clamp } from '../clamp';
import { ZONES, type Point } from '../data';
import { classesFor, computeBudget, costIndex, cutCreep, legislatureVotes, stateFundingGrowth, stateFundingLevel } from './budget';
import { samplePoint } from './geo';
import { regionOf } from './regions';
import { cellAt, zoneGrid } from './grid';
import { gradeOf, M, MAX_GRADE, oneKid } from './model';
import { CITYWIDE_INTAKE, exitCapacityFor, pick, SCHOOL_INFO, voiceFor } from './population';
import { draw, stream } from './rng';
import { closuresTakingEffect, decideClosures, rezoneDraw, resolveSchool, type ClosureTally, type Mover } from './closures';
import { buildSchools, computeDials } from './schools';
import { decideRezoned, plannedRiders, planZoning, projectRiders, type RezoneMover, type RezoneTally } from './boundaries';
import { defaultZones, homesByCell, nextZone, zoningYear, type ZoningYear } from './zones';
import { expectedYes, levyAfter, levyBallot, levyRateFor, voteYes } from './election';
import { meanTrust, trustAfterYear, type Trust } from './trust';
import type {
  Ballot,
  Budget,
  ClosedSchool,
  ElectionOutcome,
  Flows,
  GameState,
  Household,
  Policy,
  SchoolChoice,
  SchoolId,
  SimMemory,
  ZoneLevel,
} from './types';

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
  /** Cells boundary edits moved this summer, by level, and how many of their edits grandfathered. */
  rezonedCells: Record<ZoneLevel, number>;
  grandfathered: 'all' | 'some' | 'none';
  rezoned: RezoneTally;
  election: ElectionOutcome | null;
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
  rezoned: RezoneTally;
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
  zoning: ZoningYear = zoningYear(defaultZones(), closures.closed, [], homesByCell(before)),
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
      const cell = cellAt(pos, z);
      const zoneSchool = resolve(zoning.zones.elementary[cell], 0, { id, pos });
      const picked = pick(mem.kChoice[z], draw(seed, year, id, D.EntrantSchool));
      households.push({
        id,
        pos,
        cell,
        kids: oneKid(0),
        zoneSchool,
        ...(closed.has(zone.school) ? { fundedAs: zone.school } : {}),
        school: joins ? resolve(picked === zone.school ? zoneSchool : picked, 0, { id, pos }) : null,
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
  const rezoneMovers: RezoneMover[] = [];
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
    const { zone, forced } = nextZone(h, ng, zoning, closed);
    const feeder = resolve(zone, ng, h);
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
      if (forced && !transition) {
        next.school = null;
        next.status = 'moved';
        rezoneMovers.push({ before: h, next, region });
        households.push(next);
        continue;
      }
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
  const rezoned = decideRezoned({ seed, year, closed, movers: rezoneMovers, households, flows });
  return { households, nextId, kResidents, kEnrolled, graduates, flows, regions, closures: closureTallies, rezoned };
}

export function stepYear(state: GameState, policy: Policy): { next: GameState; facts: YearFacts } {
  const mem = state.sim!;
  const year = state.year;
  const index = costIndex(year);
  const closing = closuresTakingEffect(state.schools, policy.closures, policy.k5ClassSize, year);
  const planned = planZoning(state, closing, policy.boundaryEdits);
  const { closed, zoning } = planned;

  // May: voters decide a levy measure on the spring ballot.
  const ballot = levyBallot(mem.levy, year, policy);
  const vote = (b: Ballot, trust: Trust, households: Household[]): ElectionOutcome => {
    const yes = voteYes(mem.seedHash, year, b.when, expectedYes(b, mem.levy.failures, meanTrust(trust, households)));
    return { ...b, yes, passed: yes >= 0.5 };
  };
  const may = ballot?.when === 'may' ? vote(ballot, mem.trust, state.households) : null;

  // June: the budget closes.
  const plan = computeBudget({
    year,
    schools: state.schools,
    policy,
    levyRate: levyRateFor(mem.levy, year, policy, may?.passed ?? null),
    election: ballot !== null,
    reserves: state.budget.reserves,
    priorSpending: mem.spending,
    cumulativeCuts: mem.cumulativeCuts,
    homeroomsCut: mem.homeroomsCut,
    restRevenue: mem.restRevenue,
    restCost: mem.restCost,
    stateFunding: stateFundingLevel(mem.seedHash, year, 'june'),
    closed: mem.closed,
    busRiders: plannedRiders(state.households, planned),
    busingLastYear: mem.busing,
  });
  const autoCuts = plan.autoCutPositions;
  const position = M.positionCost * index;
  const classroomShare = -plan.lines.find((l) => l.key === 'homerooms')!.amount / (plan.spending + autoCuts * position);

  const { households, nextId, kResidents, kEnrolled, graduates, flows, regions, closures, rezoned } = familiesDecide(
    mem,
    state.households,
    year,
    policy.k5ClassSize,
    autoCuts,
    { closed, cards: mem.cards },
    zoning,
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

  // Winter: closures and second moves cost trust, calm years earn it, and November's ballot is counted.
  const trust = trustAfterYear(mem.trust, households, closing.map((c) => c.school));
  const november = ballot?.when === 'november' ? vote(ballot, trust, households) : null;
  const election = may ?? november;
  const levy = levyAfter(mem.levy, year, policy, election?.passed ?? null);

  const nextPolicy: Policy = { ...policy, levyRate: levy.rate, levyElection: 'may', reserveDraw: 0, closures: [], boundaryEdits: [] };
  const cumulativeCuts = mem.cumulativeCuts + autoCuts + midYearCuts;
  const spending = plan.spending - midYearSavings;
  const busing = -(plan.lines.find((l) => l.key === 'busing')?.amount ?? 0);
  const sim = { ...mem, nextId, cumulativeCuts, homeroomsCut, spending, closed, busing, levy, trust, ghost: undefined };
  const { zones } = zoning;
  const budget = computeBudget({
    year: year + 1,
    schools,
    policy: nextPolicy,
    levyRate: levyRateFor(levy, year + 1, nextPolicy, null),
    election: levyBallot(levy, year + 1, nextPolicy) !== null,
    reserves,
    priorSpending: spending,
    cumulativeCuts,
    homeroomsCut,
    restRevenue: mem.restRevenue,
    restCost: mem.restCost,
    stateFunding: stateFundingLevel(mem.seedHash, year + 1, 'january'),
    closed,
    busRiders: projectRiders(households, zoningYear(zones, closed, [], homesByCell(households)), closed, new Set()),
    busingLastYear: busing,
  });
  const nextState: GameState = {
    seed: state.seed,
    year: year + 1,
    schools,
    households,
    budget,
    dials: computeDials({ households, schools, budget }, autoCuts + midYearCuts, meanTrust(trust, households)),
    policy: nextPolicy,
    zones,
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
      rezonedCells: { elementary: zoning.changed.elementary.size, middle: zoning.changed.middle.size },
      grandfathered: grandfathering([...zoning.changed.elementary.values(), ...zoning.changed.middle.values()]),
      rezoned,
      election,
    },
  };
}

function grandfathering(flags: boolean[]): YearFacts['grandfathered'] {
  if (flags.every(Boolean)) return 'all';
  return flags.some(Boolean) ? 'some' : 'none';
}

function countKid(regions: RegionTally, pos: Point): { kids: number; leavers: number } | null {
  const name = regionOf(pos);
  if (!name) return null;
  let r = regions.get(name);
  if (!r) regions.set(name, (r = { kids: 0, leavers: 0 }));
  r.kids++;
  return r;
}

/** A K-5 returner picks among its home zone's schools, its zone school standing in for the zone's own. */
function returnSchool(kChoice: SchoolChoice[], h: Household, grade: number, feeder: SchoolId, u: number): SchoolId {
  if (grade >= 6) return feeder;
  const z = zoneGrid().cells[h.cell].elemZone;
  const picked = pick(kChoice[z], u);
  return picked === ZONES.elementary[z].school ? feeder : picked;
}
