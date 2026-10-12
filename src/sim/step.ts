import { clamp } from '../clamp';
import { ZONES, type Point } from '../data';
import { classesFor, computeBudget, costIndex, cutCreep, legislatureVotes, stateFundingGrowth, stateFundingLevel } from './budget';
import { samplePoint } from './geo';
import { regionOf } from './regions';
import { cellAt, zoneGrid } from './grid';
import { gradeOf, M, MAX_GRADE, oneKid } from './model';
import { CITYWIDE_INTAKE, exitCapacityFor, pick, voiceFor } from './population';
import { draw, stream } from './rng';
import { closuresTakingEffect, decideClosures, rezoneDraw, resolveSchool, type ClosureTally, type Mover } from './closures';
import { buildSchools, computeDials } from './schools';
import { decideRezoned, plannedRiders, planZoning, projectRiders, type RezoneMover, type RezoneTally } from './boundaries';
import { defaultZones, homesByCell, nextZone, zoningYear, type ZoningYear } from './zones';
import { effectiveGradeChanges, shutTo, topGrade, type ConversionTally } from './gradeSpan';
import { expectedYes, levyAfter, levyBallot, levyRateFor, passes, voteYes } from './election';
import { meanTrust, strainFor, trustAfterYear, type Strain, type Trust } from './trust';
import { closurePrograms, dliPathway, effectiveProgramMoves, entrantProgram, entrantSite, programMoveDraw, programStay, programsAt, type ProgramTally } from './programs';
import { SCHOOL_INFO } from './population';
import type {
  Ballot,
  Budget,
  ClosedSchool,
  ConvertedSchool,
  ElectionOutcome,
  Flows,
  GameState,
  Household,
  MovedProgram,
  Policy,
  Program,
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
  /** Grade-span changes that took effect this summer. */
  converting: ConvertedSchool[];
  conversions: ConversionTally[];
  programMoves: ProgramTally[];
  /** Cells boundary edits moved this summer, by level, and how many of their edits grandfathered. */
  rezonedCells: Record<ZoneLevel, number>;
  grandfathered: 'all' | 'some' | 'none';
  rezoned: RezoneTally;
  election: ElectionOutcome | null;
  /** Mean trust before and after the year, the citywide strain, and the regions closures and second moves cost, biggest drop first. */
  trust: { before: number; after: number; fell: string[]; strain: Strain };
}

/** Kindergarten capture by fall year: 74% in 2025 rising to the 79% PSU assumes by 2028. */
export function kCaptureTrend(year: number): number {
  return M.kCapture2025 + (M.kCapture2028 - M.kCapture2025) * clamp((year - 2025) / 3, 0, 1);
}

/** model.worseYear: extra yearly exit from class size above the base and positions cut. */
export function worseYear(classSize: number, positionsCut: number): number {
  return clamp(
    (classSize - M.baseClassSize) * M.classSizeExitPerKid + (positionsCut / 100) * M.cutsExitPer100Positions,
    -M.betterYearCap,
    M.worseYearCap,
  );
}

/** model.movingRoll: the chance a PPS household leaves this fall. */
export function leaveChance(h: Household, schoolChange: boolean, worse: number): number {
  const base = schoolChange ? M.grade6Exit : M.leaveRate * (M.leaveBase + M.leavePerExit * h.exitCapacity);
  return base + worse * (M.worseBase - M.worsePerLoyalty * h.loyalty);
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
  conversions: ConversionTally[];
  programMoves: ProgramTally[];
}

/** Closures in force this fall and the hidden cards that steer them. */
export interface ClosureYear {
  /** Every closure in force, this year's included. */
  closed: ClosedSchool[];
  cards: SimMemory['cards'];
  /** Every grade-span change in force, this year's included. */
  converted?: ConvertedSchool[];
  /** Every program move in force, this year's included. */
  programMoves?: MovedProgram[];
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
  const converted = closures.converted ?? [];
  const k5 = new Set(converted.map((c) => c.school));
  const converting = converted.filter((c) => c.year === year);
  const convertingNow = new Map(converting.map((c) => [c.school, c]));
  const shut = shutTo(closed, k5);
  const programMoves = closures.programMoves ?? [];
  const offeredBefore = programsAt(programMoves.filter((m) => m.year < year));
  const programTallies: ProgramTally[] = programMoves
    .filter((m) => m.year === year)
    .map((m) => ({ ...m, joins: !!offeredBefore.get(m.to)?.has(m.program), arrived: 0, stayers: [] }));
  const programMoving = new Map<SchoolId, Map<Program, ProgramTally>>();
  for (const t of programTallies) for (const f of t.from) programMoving.set(f, (programMoving.get(f) ?? new Map()).set(t.program, t));
  const offered = programsAt(programMoves);
  const resolve = (school: SchoolId, grade: number, h: Pick<Household, 'id' | 'pos'>) =>
    closed.has(school) ? resolveSchool(closed, school, grade, h.pos, rezoneDraw(seed, h.id), shut) : school;

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
    const zoneCapture = clamp(mem.kCapture[z] + capture - M.kCapture2025 - entrantBump - closedZoneDrop, 0, M.kCaptureMax);
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
      const drawn = joins ? entrantProgram(seed, year, id, picked) : undefined;
      const site = drawn ? entrantSite(programMoves, offered, shut, picked, drawn) : null;
      const program = site ? drawn : undefined;
      const entrant: Household = {
        id,
        pos,
        cell,
        kids: oneKid(0),
        zoneSchool,
        ...(closed.has(zone.school) ? { fundedAs: zone.school } : {}),
        school: joins ? resolve(site && site !== picked ? site : picked === zone.school ? zoneSchool : picked, 0, { id, pos }) : null,
        exitCapacity,
        loyalty: clamp(mem.zoneKeep[z] + (rand() - 0.5) * M.loyaltyNoise, 0, 1),
        voice: voiceFor(exitCapacity, rand()),
        status: joins ? 'stayed' : 'left',
      };
      // Every household has a `program` slot, set last and never deleted, so households share one fast shape.
      entrant.program = program;
      households.push(entrant);
    }
  });

  // Summer: 8th graders leave. Fall: everyone else may move.
  const bumpK5 = worseYear(classSize, positionsCut);
  const bumpOther = worseYear(M.baseClassSize, positionsCut);
  const flows: Flows = { stayed: 0, movedWithinPps: 0, leftPps: 0, cameBack: 0, enteredK: kEnrolled, graduated: 0 };
  const regions: RegionTally = new Map();
  const movers: Mover[] = [];
  const rezoneMovers: RezoneMover[] = [];
  const spanMovers: RezoneMover[] = [];
  const closureFollowers: { from: SchoolId; to: SchoolId }[] = [];
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
    const { zone, forced } = nextZone(h, ng, zoning, shut);
    const feeder = resolve(zone, ng, h);
    next.zoneSchool = feeder;
    if (h.school !== null) {
      const region = countKid(regions, h.pos);
      const top = topGrade(h.school, k5);
      // model.programMove: the program's kids follow it, or stay without it and choose like their schoolmates.
      const move = h.program && programMoving.get(h.school)?.get(h.program);
      if (move && ng <= top && SCHOOL_INFO.get(move.to)!.lo <= ng && ng <= topGrade(move.to, k5)) {
        if (programMoveDraw(seed, year, h.id) < programStay(h.pos, move.to)) {
          Object.assign(next, { school: move.to, status: 'moved', movedFrom: h.school, forcedMoves: (h.forcedMoves ?? 0) + 1 });
          flows.movedWithinPps++;
          move.arrived++;
          if (closingNow.has(h.school)) closureFollowers.push({ from: h.school, to: move.to });
          households.push(next);
          continue;
        }
        next.program = undefined;
        move.stayers.push(next);
      }
      if (closingNow.has(h.school) && ng <= top) {
        // Placeholders until decideClosures, so nothing else counts or picks the mover.
        next.school = null;
        next.status = 'moved';
        movers.push({ before: h, next, closure: closed.get(h.school)!, fallback: feeder, region });
        households.push(next);
        continue;
      }
      const conversion = convertingNow.get(h.school);
      if (conversion && g >= 6) {
        next.school = null;
        next.status = 'moved';
        // A non-grandfathered edit that moved the block sends the kid to its new zone school instead.
        spanMovers.push({ before: h, next, region, ...(zoning.changed.middle.get(h.cell) === false ? {} : { target: conversion.to }) });
        households.push(next);
        continue;
      }
      const transition = ng > top;
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
          (next.program && dliPathway(next.program, feeder, h.pos, ng, offered, shut)) ||
          (draw(seed, year, h.id, D.Feeder) < M.feederShare
            ? feeder
            : resolve(pick(mem.msMix, draw(seed, year, h.id, D.MiddleSchool)), ng, h));
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
  // model.gradeSpan: a conversion's middle zone is the receiver's now, so its movers arrive before closures' kids.
  const conversions = converting.map((c) => ({
    school: c.school,
    to: c.to,
    ...decideRezoned({
      seed,
      year,
      shut,
      movers: spanMovers.filter((m) => m.before.school === c.school),
      households,
      flows,
      stay: M.conversionStay,
    }),
  }));
  const closureTallies = decideClosures({
    seed,
    year,
    followRate: closures.cards.followRate,
    closed,
    closing,
    movers,
    households,
    flows,
    shut,
  });
  // A closing school's program followers stay in PPS, at the program's host.
  for (const { from, to } of closureFollowers) {
    const t = closureTallies.find((c) => c.school === from)!;
    t.kids++;
    if (closed.get(from)!.receivers.some((r) => r.school === to)) t.receivers[to] = (t.receivers[to] ?? 0) + 1;
    else t.otherPps++;
  }
  const rezoned = decideRezoned({ seed, year, shut, movers: rezoneMovers, households, flows });
  for (const h of households) if (h.program && !(h.school && offered.get(h.school)?.has(h.program))) h.program = undefined;
  return {
    households,
    nextId,
    kResidents,
    kEnrolled,
    graduates,
    flows,
    regions,
    closures: closureTallies,
    rezoned,
    conversions,
    programMoves: programTallies,
  };
}

export function stepYear(state: GameState, policy: Policy): { next: GameState; facts: YearFacts } {
  const mem = state.sim!;
  const year = state.year;
  const index = costIndex(year);
  const closing = closuresTakingEffect(state.schools, policy.closures, policy.k5ClassSize, year);
  const converting = effectiveGradeChanges(state.schools, policy.gradeChanges).map((g) => ({ ...g, year }));
  const converted = [...mem.converted, ...converting];
  const plannedPrograms = effectiveProgramMoves(state.schools, policy.programMoves);
  const k5 = new Set(converted.map((c) => c.school));
  const programMoving = [...plannedPrograms, ...closurePrograms(state.schools, closing, plannedPrograms, k5)].map((m) => ({ ...m, year }));
  const programMoves = [...mem.programMoves, ...programMoving];
  const planned = planZoning(state, closing, policy.boundaryEdits, converting);
  const { closed, zoning } = planned;

  // May: voters decide a levy measure on the spring ballot.
  const ballot = levyBallot(mem.levy, year, policy);
  const vote = (b: Ballot, trust: Trust, households: Household[]): ElectionOutcome => {
    const yes = voteYes(mem.seedHash, year, b.when, expectedYes(b, mem.levy.failures, meanTrust(trust, households)));
    return { ...b, yes, passed: passes(yes) };
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
  const rehired = plan.rehired ?? 0;
  const position = M.positionCost * index;
  const classroomShare = -plan.lines.find((l) => l.key === 'homerooms')!.amount / (plan.spending + (autoCuts - rehired) * position);

  const { households, nextId, kResidents, kEnrolled, graduates, flows, regions, closures, rezoned, conversions, programMoves: programTallies } =
    familiesDecide(mem, state.households, year, policy.k5ClassSize, autoCuts, { closed, cards: mem.cards, converted, programMoves }, zoning);

  // October: classes form, short the homerooms that cuts removed.
  const octoberCut = Math.max(0, mem.homeroomsCut + Math.round((autoCuts - rehired) * classroomShare));
  const schools = buildSchools(households, policy.k5ClassSize, octoberCut, closed, converted, programMoves);
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
  const midYearSavings = midYearCuts * position * M.midYearPayShare;
  const homeroomsCut = octoberCut + Math.round(midYearCuts * classroomShare);
  const reserves = plan.reservesAfter + midYearSavings;

  // Winter: closures, second moves, cuts and larger classes cost trust, and calm years earn it.
  // November's ballot is counted before mid-year cuts land.
  const closingIds = closing.map((c) => c.school);
  const strainAfter = (cuts: number) => strainFor(policy.k5ClassSize, mem.k5ClassSize, cuts);
  const trustWith = (strain: Strain) => trustAfterYear(mem.trust, households, closingIds, strain);
  const november = ballot?.when === 'november' ? vote(ballot, trustWith(strainAfter(autoCuts)), households) : null;
  const strain = strainAfter(autoCuts + midYearCuts);
  const trust = trustWith(strain);
  const forced = trustWith({ cuts: 0, classes: 0, calmGain: 0 });
  const election = may ?? november;
  const levy = levyAfter(mem.levy, year, policy, election?.passed ?? null);

  const nextPolicy: Policy = { ...policy, levyRate: levy.rate, levyElection: 'may', reserveDraw: 0, closures: [], boundaryEdits: [], gradeChanges: [], programMoves: [] };
  const cumulativeCuts = mem.cumulativeCuts + autoCuts + midYearCuts - rehired;
  const spending = plan.spending - midYearSavings;
  const busing = -(plan.lines.find((l) => l.key === 'busing')?.amount ?? 0);
  const sim = { ...mem, nextId, k5ClassSize: policy.k5ClassSize, cumulativeCuts, homeroomsCut, spending, closed, converted, programMoves, busing, levy, trust, ghost: undefined };
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
      converting,
      conversions,
      programMoves: programTallies,
      rezonedCells: { elementary: zoning.changed.elementary.size, middle: zoning.changed.middle.size },
      grandfathered: grandfathering([...zoning.changed.elementary.values(), ...zoning.changed.middle.values()]),
      rezoned,
      election,
      trust: {
        before: meanTrust(mem.trust, state.households),
        after: meanTrust(trust, households),
        fell: Object.keys(trust)
          .filter((r) => forced[r] < mem.trust[r])
          .sort((a, b) => trust[a] - mem.trust[a] - (trust[b] - mem.trust[b])),
        strain,
      },
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
