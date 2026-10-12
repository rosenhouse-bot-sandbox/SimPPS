import { computeBudget, FIRST_YEAR, generalFund, stateFundingLevel } from './budget';
import { CLOSED_ZONE_CAPTURE_DROPS, FOLLOW_RATES, gradeOf, HIDDEN_CARDS, M, REVEAL_AFTER_YEARS } from './model';
import { expectedYes, levyBallot, levyRateFor, pollRange } from './election';
import { meanTrust, startTrust, strainCost, trustAfterYear } from './trust';
import { clamp } from '../clamp';
import { generatePopulation } from './population';
import { headlines, rezoneOutcome, seasonEvents, versusGhost } from './report';
import { draw, hashString } from './rng';
import { buildSchools, computeDials } from './schools';
import { closureChip as chipFor, closureOutcomes, effectiveClosures, normalizeClosures, type ClosureChip } from './closures';
import { closureRiders, plannedRiders, planZoning } from './boundaries';
import { defaultZones, normalizeBoundaryEdits } from './zones';
import { SCENARIOS, type Start } from './scenarios';
import { familiesDecide, stepYear } from './step';
import type { Ballot, Budget, Closure, GameState, Household, Policy, Range, Reveal, SimMemory, YearReport, ZoneMap } from './types';

export * from './types';
export { modeledRange } from './range';
export { FIRST_YEAR, legislatureVotes, levyRevenue } from './budget';
export { canClose, receiverCandidates, type ClosureChip } from './closures';
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
export { FATE_DONE } from './report';
export const MOTHBALL_PER_YEAR = M.mothball;

/** A closure's chip, its new bus riders included. */
export function closureChip(state: GameState, closure: Closure, plan: Closure[], classSize: number): ClosureChip {
  return chipFor(state, closure, plan, classSize, closureRiders(state, closure, plan));
}

export const DEFAULT_POLICY: Policy = { k5ClassSize: 24, levyRate: 1.99, levyElection: 'may', reserveDraw: 0, closures: [], boundaryEdits: [] };

/** A start loads its closures into the first plan as ordinary edits. */
export function newGame(opts: { seed: string; start?: Start }): GameState {
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
  const households = settle(fall2026.households);
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
    nextId: fall2026.nextId,
    kChoice: pop.kChoice,
    msMix: pop.msMix,
    zoneKeep: pop.zoneKeep,
    kCohort: pop.kCohort,
    kCapture: pop.kCapture,
    cumulativeCuts: 0,
    spending: M.generalFund,
    homeroomsCut: 0,
    restRevenue: total + M.startGap - revenue,
    restCost: total - cost,
    closed: [],
    busing: 0,
    levy,
    trust: startTrust(seedHash),
    cards: {
      followRate: FOLLOW_RATES[Math.floor(draw(seedHash, 1) * FOLLOW_RATES.length)],
      closedZoneCaptureDrop: CLOSED_ZONE_CAPTURE_DROPS[Math.floor(draw(seedHash, 2) * CLOSED_ZONE_CAPTURE_DROPS.length)],
    },
  };
  const policy = { ...DEFAULT_POLICY, closures: SCENARIOS[opts.start ?? 'status-quo'].closures };
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

/** Clamps K-5 class size to 22-28, keeps the levy rate and reserve draw at or above zero and tidies closures and boundary edits. */
export function normalizePolicy(p: Policy): Policy {
  return {
    ...p,
    closures: normalizeClosures(p.closures),
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
  const planned = planZoning(state, effectiveClosures(state.schools, plan.closures), plan.boundaryEdits);
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
  return planZoning(state, effectiveClosures(state.schools, plan.closures), plan.boundaryEdits).zoning.zones;
}

export type BallotPreview = Ballot & { poll: Range };

/** The levy measure `policy` puts on this year's ballot, with a poll of the yes share. */
export function ballotPreview(state: GameState, policy: Policy): BallotPreview | null {
  const sim = state.sim!;
  const plan = normalizePolicy(policy);
  const ballot = levyBallot(sim.levy, state.year, plan);
  if (!ballot) return null;
  const trust = ballot.when === 'november' ? trustAfterClosures(state, plan) : state.dials.trust;
  return { ...ballot, poll: pollRange(expectedYes(ballot, sim.levy.failures, trust)) };
}

/** November counts after summer's closures and planned June cuts. Closing schools' current kids stand in for the kids they move. */
function trustAfterClosures(state: GameState, plan: Policy): number {
  const closing = new Set(effectiveClosures(state.schools, plan.closures).map((c) => c.school));
  const moved = state.households.map(({ movedFrom: _, ...h }) =>
    h.school !== null && closing.has(h.school) ? { ...h, movedFrom: h.school } : h,
  );
  const strain = strainCost(plan.k5ClassSize, previewBudget(state, plan).autoCutPositions);
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
      ...(mine.facts.rezoned.kids > 0 ? { rezoned: rezoneOutcome(mine.facts.rezoned) } : {}),
      ...(mine.facts.election ? { election: mine.facts.election } : {}),
      ...(ghostYear.facts.election ? { ghostElection: ghostYear.facts.election } : {}),
      reveals: reveals(state.sim!, state.year),
    },
  };
}
