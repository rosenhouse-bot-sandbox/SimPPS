import { computeBudget, FIRST_YEAR, generalFund } from './budget';
import { CLOSED_ZONE_CAPTURE_DROPS, FOLLOW_RATES, M } from './model';
import { clamp } from '../clamp';
import { generatePopulation } from './population';
import { headlines, seasonEvents, versusGhost } from './report';
import { draw, hashString } from './rng';
import { buildSchools, computeDials } from './schools';
import { familiesDecide, stepYear } from './step';
import type { Budget, GameState, Household, Policy, SimMemory, YearReport } from './types';

export * from './types';
export { modeledRange } from './range';
export { levyRevenue } from './budget';

export const DEFAULT_POLICY: Policy = { k5ClassSize: 24, levyRate: 1.99, reserveDraw: 0, closures: [] };

export function newGame(opts: { seed: string }): GameState {
  const seedHash = hashString(opts.seed);
  const pop = generatePopulation(seedHash);
  const fall2026 = familiesDecide(
    { ...pop, seedHash, nextId: pop.households.length },
    pop.households,
    FIRST_YEAR - 1,
    DEFAULT_POLICY.k5ClassSize,
    0,
  );
  const households = settle(fall2026.households);
  const schools = buildSchools(households, DEFAULT_POLICY.k5ClassSize);
  const input = {
    year: FIRST_YEAR,
    schools,
    policy: DEFAULT_POLICY,
    reserves: M.reserves,
    priorSpending: M.generalFund,
    cumulativeCuts: 0,
    homeroomsCut: 0,
    restRevenue: 0,
    restCost: 0,
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
    cards: {
      followRate: FOLLOW_RATES[Math.floor(draw(seedHash, 1) * FOLLOW_RATES.length)],
      closedZoneCaptureDrop: CLOSED_ZONE_CAPTURE_DROPS[Math.floor(draw(seedHash, 2) * CLOSED_ZONE_CAPTURE_DROPS.length)],
    },
  };
  const budget = computeBudget({ ...input, restRevenue: sim.restRevenue, restCost: sim.restCost });
  return {
    seed: opts.seed,
    year: FIRST_YEAR,
    schools,
    households,
    budget,
    dials: computeDials({ households, schools, budget }, 0),
    policy: DEFAULT_POLICY,
    sim,
  };
}

/** Play opens before anyone has decided this year, so the map shows no leavers. */
function settle(households: Household[]): Household[] {
  return households
    .filter((h) => !h.movedAway)
    .map(({ leftThisYear: _, ...h }) => ({ ...h, status: h.school ? 'stayed' : 'left' }));
}

/** Clamps K-5 class size to 22-28 and keeps the levy rate and reserve draw at or above zero. */
export function normalizePolicy(p: Policy): Policy {
  return {
    ...p,
    k5ClassSize: clamp(Math.round(p.k5ClassSize), 22, 28),
    levyRate: Math.max(0, p.levyRate),
    reserveDraw: Math.max(0, p.reserveDraw),
  };
}

/** The coming year's budget if the player commits `policy`. Use it to preview edits before End Year. */
export function previewBudget(state: GameState, policy: Policy): Budget {
  const sim = state.sim!;
  return computeBudget({
    year: state.year,
    schools: state.schools,
    policy: normalizePolicy(policy),
    reserves: state.budget.reserves,
    priorSpending: sim.spending,
    cumulativeCuts: sim.cumulativeCuts,
    homeroomsCut: sim.homeroomsCut,
    restRevenue: sim.restRevenue,
    restCost: sim.restCost,
  });
}

/** Plays a year for the player and for the do-nothing ghost (model.ghost). */
export function endYear(state: GameState, policy: Policy): { next: GameState; report: YearReport } {
  const mine = stepYear(state, normalizePolicy(policy));
  const ghost = stepYear(state.sim!.ghost ?? state, DEFAULT_POLICY).next;
  const next: GameState = { ...mine.next, sim: { ...mine.next.sim!, ghost } };
  return {
    next,
    report: {
      year: state.year,
      events: seasonEvents(mine.facts),
      flows: mine.facts.flows,
      vsGhost: versusGhost(next.dials, ghost.dials),
      headlines: headlines(mine.facts, state.dials, next.dials),
    },
  };
}
