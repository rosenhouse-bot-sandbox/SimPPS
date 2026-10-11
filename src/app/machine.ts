import type { Budget, GameState, Policy, Season, YearReport } from '../sim/types';

export type Phase = 'plan' | 'preflight' | 'playing' | 'report';

export interface Sim {
  newGame(opts: { seed: string }): GameState;
  endYear(state: GameState, policy: Policy): { next: GameState; report: YearReport };
  previewBudget(state: GameState, policy: Policy): Budget;
  normalizePolicy(policy: Policy): Policy;
}

/** One played year. A later milestone branches from `start`. */
export interface Turn {
  start: GameState;
  policy: Policy;
  report: YearReport;
  end: GameState;
}

export interface AppState {
  phase: Phase;
  /** The state being planned, or the state the playing year started from. */
  game: GameState;
  draft: Policy;
  history: Turn[];
}

export type Action =
  | { type: 'edit'; policy: Partial<Policy> }
  | { type: 'preflight' }
  | { type: 'back' }
  | { type: 'confirm' }
  | { type: 'playbackDone' }
  | { type: 'nextYear' };

/** A reserve draw is once, so each plan starts with none. */
function draftFor(game: GameState): Policy {
  return { ...game.policy, reserveDraw: 0 };
}

export function initApp(sim: Sim, seed: string): AppState {
  const game = sim.newGame({ seed });
  return { phase: 'plan', game, draft: draftFor(game), history: [] };
}

export function lastTurn(s: AppState): Turn | undefined {
  return s.history[s.history.length - 1];
}

const DECIDED: Season[] = ['fall', 'october', 'winter'];

/** Families decide in fall, so the map shows the year's outcome from then on. */
export function mapState(s: AppState, season: Season): GameState {
  const turn = lastTurn(s);
  if (turn && (s.phase === 'report' || (s.phase === 'playing' && DECIDED.includes(season)))) return turn.end;
  return s.game;
}

export function makeReducer(sim: Sim) {
  return function reduce(s: AppState, a: Action): AppState {
    switch (a.type) {
      case 'edit':
        return s.phase === 'plan' ? { ...s, draft: sim.normalizePolicy({ ...s.draft, ...a.policy }) } : s;
      case 'preflight':
        return s.phase === 'plan' ? { ...s, phase: 'preflight' } : s;
      case 'back':
        return s.phase === 'preflight' ? { ...s, phase: 'plan' } : s;
      case 'confirm': {
        if (s.phase !== 'preflight') return s;
        const { next, report } = sim.endYear(s.game, s.draft);
        const turn: Turn = { start: s.game, policy: s.draft, report, end: next };
        return { ...s, phase: 'playing', history: [...s.history, turn] };
      }
      case 'playbackDone':
        return s.phase === 'playing' ? { ...s, phase: 'report' } : s;
      case 'nextYear': {
        const turn = lastTurn(s);
        if (s.phase !== 'report' || !turn) return s;
        return { ...s, phase: 'plan', game: turn.end, draft: draftFor(turn.end) };
      }
    }
  };
}
