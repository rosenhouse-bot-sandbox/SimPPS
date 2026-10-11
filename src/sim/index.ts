// Placeholder until the simulation lands. It keeps the contract compiling for the UI.
import type { GameState, Policy, YearReport } from './types';

export * from './types';

export const DEFAULT_POLICY: Policy = { k5ClassSize: 24, levyRate: 1.99, reserveDraw: 0, closures: [] };

export function newGame(opts: { seed: string }): GameState {
  return {
    seed: opts.seed,
    year: 2027,
    schools: {},
    households: [],
    budget: { lines: [], gap: -65_200_000, autoCutPositions: 0, reserves: 41_100_000, reservePct: 0.048 },
    dials: { kids: 26_400, capture: 0.766, kindergartenCapture: 0.74, gap: -65_200_000, positionsCut: 0, reservePct: 0.048, kidsInUrm: 4_500 },
    policy: DEFAULT_POLICY,
  };
}

export function endYear(state: GameState, policy: Policy): { next: GameState; report: YearReport } {
  return {
    next: { ...state, year: state.year + 1, policy },
    report: { year: state.year, events: [], flows: { stayed: 0, movedWithinPps: 0, leftPps: 0, cameBack: 0 }, vsGhost: [], headlines: [] },
  };
}
