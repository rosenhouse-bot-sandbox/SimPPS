import { computeBudget, FIRST_YEAR, generalFund, stateFundingLevel } from './budget';
import { CLOSED_ZONE_CAPTURE_DROPS, FOLLOW_RATES, gradeOf, HIDDEN_CARDS, M, MAX_GRADE, MODEL_DEFAULTS, REVEAL_AFTER_YEARS, setModelParams } from './model';
import { expectedYes, levyBallot, levyRateFor, pollRange } from './election';
import { meanTrust, startTrust, strainFor, trustAfterYear } from './trust';
import { clamp } from '../clamp';
import { generatePopulation } from './population';
import { headlines, rezoneOutcome, seasonEvents, versusGhost } from './report';
import { draw, hashString } from './rng';
import { buildSchools, computeDials } from './schools';
import { closureChip as chipFor, closureOutcomes, effectiveClosures, normalizeClosures, type ClosureChip as BaseClosureChip } from './closures';
import { closureRiders, plannedRiders, planZoning } from './boundaries';
import { defaultZones, normalizeBoundaryEdits } from './zones';
import { SCENARIOS, type Start } from './scenarios';
import { conversionChip as spanChip, conversionOutcomes, convertedIn, effectiveGradeChanges, normalizeGradeChanges, topGrade, type ConversionChip } from './gradeSpan';
import { familiesDecide, stepYear } from './step';
import { assignDli, closurePrograms, effectiveProgramMoves, normalizeProgramMoves, programMoveOutcomes, withProgramArrivals } from './programs';
import { SCHOOL_INFO } from './population';
import type { Ballot, Budget, Closure, GameState, GradeSpanChange, Household, ModelOverrides, Policy, ProgramMove, Range, Reveal, SimMemory, YearReport, ZoneMap } from './types';

export * from './types';
export { modeledRange } from './range';
export { FIRST_YEAR, legislatureVotes, levyRevenue } from './budget';
export { canClose, receiverCandidates } from './closures';
export { canConvert, middleSchoolCandidates, middleZoneOf, type ConversionChip } from './gradeSpan';
export { boundaryChip, sliceEdit, type BoundaryChip } from './boundaries';
export {
  CELL_METERS,
  cellAtPoint,
  defaultZones,
  isContiguous,
  neighbors,
  sliceCells,
  zoneGrid,
  type ZoneCell,
  type ZoneGrid,
} from './zones';
export { walkLimit } from './walk';
export { SCENARIOS, type Start } from './scenarios';
export { DLI_PROGRAMS } from './programs';
export { FATE_DONE } from './report';

export interface ClosureChip extends BaseClosureChip {
  /** The school's DLI programs that move with the closure. */
  programs: ProgramMove[];
}

/** Applies the plan's program moves to the schools and drops the kids they move. */
function withPlannedPrograms(state: GameState, moves: readonly ProgramMove[]): GameState {
  const planned = effectiveProgramMoves(state.schools, moves);
  const moving = new Set(planned.flatMap((m) => m.from.map((f) => `${m.program} ${f}`)));
  return {
    ...state,
    schools: withProgramArrivals(state.schools, planned),
    households: state.households.filter((h) => !moving.has(`${h.program} ${h.school}`)),
  };
}

/** A closure's chip, its new bus riders, the plan's grade-span arrivals and program moves included. */
export function closureChip(
  state: GameState,
  closure: Closure,
  plan: Closure[],
  classSize: number,
  converting: GradeSpanChange[] = [],
  programMoves: ProgramMove[] = [],
): ClosureChip {
  const others = plan.filter((c) => c.school !== closure.school);
  const programs = carriedPrograms(state, [...others, closure], converting, programMoves).filter((m) => m.from.includes(closure.school));
  const moved = withPlannedPrograms(state, programMoves);
  return {
    ...chipFor(moved, closure, plan, classSize, closureRiders(state, closure, plan), converting, (schools) => withProgramArrivals(schools, programs)),
    programs,
  };
}

/** The DLI programs the plan's closures carry, after its grade-span changes. */
function carriedPrograms(state: GameState, closures: Closure[], gradeChanges: GradeSpanChange[], programMoves: ProgramMove[]): ProgramMove[] {
  const k5 = new Set([
    ...Object.values(state.schools).flatMap((s) => (s.converted ? [s.id] : [])),
    ...effectiveGradeChanges(state.schools, gradeChanges).map((g) => g.school),
  ]);
  return closurePrograms(state.schools, effectiveClosures(state.schools, closures), effectiveProgramMoves(state.schools, programMoves), k5);
}

/** A grade-span change's chip, the plan's program moves included. */
export function conversionChip(state: GameState, change: GradeSpanChange, plan: Policy): ConversionChip {
  return spanChip(withPlannedPrograms(state, plan.programMoves ?? []), change, plan);
}

/** The DLI programs the plan's closures carry to new schools. */
export function closureProgramMoves(state: GameState, policy: Policy): ProgramMove[] {
  const plan = normalizePolicy(policy);
  return carriedPrograms(state, plan.closures, plan.gradeChanges, plan.programMoves);
}

export const DEFAULT_POLICY: Policy = { k5ClassSize: 24, levyRate: MODEL_DEFAULTS.levyRate, levyElection: 'may', reserveDraw: 0, closures: [], boundaryEdits: [], gradeChanges: [], programMoves: [] };

/** A start loads its closures into the first plan as ordinary edits. The game keeps `model` for every year it plays. */
export function newGame(opts: { seed: string; start?: Start; model?: ModelOverrides }): GameState {
  setModelParams(opts.model);
  const seedHash = hashString(opts.seed);
  const pop = generatePopulation(seedHash);
  const middle = defaultZones().middle;
  const zoned = pop.households.map((h) => (gradeOf(h) >= 6 ? { ...h, zoneSchool: middle[h.cell] } : h));
  const fall2026 = familiesDecide(
    { ...pop, seedHash, nextId: pop.households.length },
    zoned,
    FIRST_YEAR - 1,
    DEFAULT_POLICY.k5ClassSize,
    0,
  );
  const households = assignDli(settle(fall2026.households), seedHash);
  const schools = buildSchools(households, DEFAULT_POLICY.k5ClassSize);
  const levy = { rate: M.levyRate, through: M.levyThrough, failures: 0 };
  const input = {
    year: FIRST_YEAR,
    schools,
    policy: DEFAULT_POLICY,
    levyRate: M.levyRate,
    reserves: M.reserves,
    priorSpending: M.generalFund,
    cumulativeCuts: 0,
    homeroomsCut: 0,
    restRevenue: 0,
    restCost: 0,
    stateFunding: stateFundingLevel(seedHash, FIRST_YEAR, 'january'),
    closed: [],
  };
  const k8 = computeBudget(input).lines;
  const revenue = k8.filter((l) => l.amount > 0).reduce((a, l) => a + l.amount, 0);
  const cost = -k8.filter((l) => l.amount < 0).reduce((a, l) => a + l.amount, 0);
  const total = generalFund(FIRST_YEAR);
  const sim: SimMemory = {
    seedHash,
    model: opts.model,
    nextId: fall2026.nextId,
    kChoice: pop.kChoice,
    msMix: pop.msMix,
    zoneKeep: pop.zoneKeep,
    kCohort: pop.kCohort,
    kCapture: pop.kCapture,
    k5ClassSize: DEFAULT_POLICY.k5ClassSize,
    cumulativeCuts: 0,
    spending: M.generalFund,
    homeroomsCut: 0,
    restRevenue: total + M.startGap - revenue,
    restCost: total - cost,
    closed: [],
    converted: [],
    programMoves: [],
    busing: 0,
    levy,
    trust: startTrust(seedHash),
    cards: {
      followRate: FOLLOW_RATES[Math.floor(draw(seedHash, 1) * FOLLOW_RATES.length)],
      closedZoneCaptureDrop: CLOSED_ZONE_CAPTURE_DROPS[Math.floor(draw(seedHash, 2) * CLOSED_ZONE_CAPTURE_DROPS.length)],
    },
  };
  const { closures, gradeChanges, programMoves } = SCENARIOS[opts.start ?? 'status-quo'];
  const policy = { ...DEFAULT_POLICY, closures, gradeChanges, programMoves };
  const budget = computeBudget({ ...input, policy, restRevenue: sim.restRevenue, restCost: sim.restCost });
  return {
    seed: opts.seed,
    year: FIRST_YEAR,
    schools,
    households,
    budget,
    dials: computeDials({ households, schools, budget }, 0, meanTrust(sim.trust, households)),
    policy,
    zones: defaultZones(),
    sim,
  };
}

/** Play opens before anyone has decided this year, so the map shows no leavers. */
function settle(households: Household[]): Household[] {
  return households
    .filter((h) => !h.movedAway)
    .map(({ leftThisYear: _, ...h }) => ({ ...h, status: h.school ? 'stayed' : 'left' }));
}

/** Clamps K-5 class size to 22-28, keeps the levy rate and reserve draw at or above zero and tidies closures, boundary edits and grade-span changes. */
export function normalizePolicy(p: Policy): Policy {
  const closures = normalizeClosures(p.closures);
  return {
    ...p,
    closures,
    gradeChanges: normalizeGradeChanges(p.gradeChanges ?? [], closures),
    programMoves: normalizeProgramMoves(p.programMoves ?? [], closures),
    boundaryEdits: normalizeBoundaryEdits(p.boundaryEdits ?? []),
    k5ClassSize: clamp(Math.round(p.k5ClassSize), 22, 28),
    levyRate: Math.max(0, p.levyRate),
    levyElection: p.levyElection === 'november' ? 'november' : 'may',
    reserveDraw: Math.max(0, p.reserveDraw),
  };
}

/** The coming year's budget if the player commits `policy`. Use it to preview edits before End Year. */
export function previewBudget(state: GameState, policy: Policy): Budget {
  const sim = state.sim!;
  const plan = normalizePolicy(policy);
  const planned = planZoning(state, effectiveClosures(state.schools, plan.closures), plan.boundaryEdits, effectiveGradeChanges(state.schools, plan.gradeChanges));
  return computeBudget({
    year: state.year,
    schools: state.schools,
    policy: plan,
    levyRate: levyRateFor(sim.levy, state.year, plan, null),
    election: levyBallot(sim.levy, state.year, plan) !== null,
    reserves: state.budget.reserves,
    priorSpending: sim.spending,
    cumulativeCuts: sim.cumulativeCuts,
    homeroomsCut: sim.homeroomsCut,
    restRevenue: sim.restRevenue,
    restCost: sim.restCost,
    stateFunding: stateFundingLevel(sim.seedHash, state.year, 'january'),
    closed: sim.closed,
    busRiders: plannedRiders(state.households, planned),
    busingLastYear: sim.busing,
  });
}

/** Each cell's zone school next fall under `policy`: its closures, then its boundary edits. */
export function plannedZones(state: GameState, policy: Policy): ZoneMap {
  const plan = normalizePolicy(policy);
  return planZoning(state, effectiveClosures(state.schools, plan.closures), plan.boundaryEdits, effectiveGradeChanges(state.schools, plan.gradeChanges))
    .zoning.zones;
}

export type BallotPreview = Ballot & { poll: Range };

/** The levy measure `policy` puts on this year's ballot, with a poll of the yes share. */
export function ballotPreview(state: GameState, policy: Policy): BallotPreview | null {
  const sim = state.sim!;
  const plan = normalizePolicy(policy);
  const ballot = levyBallot(sim.levy, state.year, plan);
  if (!ballot) return null;
  const trust = ballot.when === 'november' ? novemberTrust(state, plan) : state.dials.trust;
  return { ...ballot, poll: pollRange(expectedYes(ballot, sim.levy.failures, trust)) };
}

/** November counts after summer's closures, grade-span changes, program moves and planned June cuts. Current kids stand in for the kids they move. */
function novemberTrust(state: GameState, plan: Policy): number {
  const closing = new Set(effectiveClosures(state.schools, plan.closures).map((c) => c.school));
  const converting = new Set(effectiveGradeChanges(state.schools, plan.gradeChanges).map((g) => g.school));
  const k5 = convertedIn(state.schools);
  const programTo = new Map(effectiveProgramMoves(state.schools, plan.programMoves).flatMap((m) => m.from.map((f) => [`${m.program} ${f}`, m.to])));
  const followsProgram = (h: Household) => {
    const to = programTo.get(`${h.program} ${h.school}`);
    const next = gradeOf(h) + 1;
    return !!to && next <= topGrade(h.school!, k5) && SCHOOL_INFO.get(to)!.lo <= next && next <= topGrade(to, k5);
  };
  const moves = (h: Household) =>
    h.school !== null &&
    (closing.has(h.school) ||
      (converting.has(h.school) && gradeOf(h) >= 6 && gradeOf(h) < MAX_GRADE) ||
      followsProgram(h));
  const moved = state.households.map(({ movedFrom: _, ...h }) => (moves(h) ? { ...h, movedFrom: h.school! } : h));
  const strain = strainFor(plan.k5ClassSize, state.sim!.k5ClassSize, previewBudget(state, plan).autoCutPositions);
  return meanTrust(trustAfterYear(state.sim!.trust, moved, [...closing], strain), state.households);
}

/** The fall year of the levy's last funded school year. */
export function levyThrough(state: GameState): number {
  return state.sim!.levy.through;
}

/** The hidden cards revealed in the report on fall `year`'s school year. */
function reveals(sim: SimMemory, year: number): Reveal[] {
  if (year !== FIRST_YEAR + REVEAL_AFTER_YEARS - 1) return [];
  return (Object.keys(HIDDEN_CARDS) as (keyof typeof HIDDEN_CARDS)[]).map((card) => ({
    sourceKey: HIDDEN_CARDS[card],
    value: sim.cards[card],
  }));
}

/** Plays a year for the player and for the do-nothing ghost (model.ghost). */
export function endYear(state: GameState, policy: Policy): { next: GameState; report: YearReport } {
  setModelParams(state.sim!.model);
  const mine = stepYear(state, normalizePolicy(policy));
  const ghostYear = stepYear(state.sim!.ghost ?? state, DEFAULT_POLICY);
  const ghost = ghostYear.next;
  const next: GameState = { ...mine.next, sim: { ...mine.next.sim!, ghost } };
  return {
    next,
    report: {
      year: state.year,
      events: seasonEvents(mine.facts),
      flows: mine.facts.flows,
      vsGhost: versusGhost(next.dials, ghost.dials),
      headlines: headlines(mine.facts, state.dials, next.dials),
      budget: mine.facts.plan,
      closures: closureOutcomes(mine.facts.closures, mine.facts.closing),
      conversions: conversionOutcomes(mine.facts.conversions),
      programMoves: programMoveOutcomes(mine.facts.programMoves, new Set(mine.facts.closing.map((c) => c.school))),
      ...(mine.facts.rezoned.kids > 0 ? { rezoned: rezoneOutcome(mine.facts.rezoned) } : {}),
      ...(mine.facts.election ? { election: mine.facts.election } : {}),
      ...(ghostYear.facts.election ? { ghostElection: ghostYear.facts.election } : {}),
      reveals: reveals(state.sim!, state.year),
    },
  };
}
