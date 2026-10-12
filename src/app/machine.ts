import type { BallotPreview, BoundaryChip, ClosureChip, ConversionChip, Start } from '../sim';
import type { BoundaryEdit, Budget, Closure, GameState, GradeSpanChange, Household, ModelOverrides, Policy, ProgramMove, SchoolId, SchoolState, Season, YearReport, ZoneLevel, ZoneMap } from '../sim/types';

export type Phase = 'plan' | 'preflight' | 'playing' | 'report';

export interface Sim {
  newGame(opts: { seed: string; start?: Start; model?: ModelOverrides }): GameState;
  endYear(state: GameState, policy: Policy): { next: GameState; report: YearReport };
  previewBudget(state: GameState, policy: Policy): Budget;
  normalizePolicy(policy: Policy): Policy;
  canClose(schools: Record<SchoolId, SchoolState>, school: SchoolId): boolean;
  receiverCandidates(
    schools: Record<SchoolId, SchoolState>,
    closing: SchoolId,
    plan: Closure[],
    converting: GradeSpanChange[],
  ): { id: SchoolId; miles: number; kids: number; capacity: number }[];
  closureChip(
    state: GameState,
    closure: Closure,
    plan: Closure[],
    classSize: number,
    converting: GradeSpanChange[],
    programMoves: ProgramMove[],
  ): ClosureChip;
  closureProgramMoves(state: GameState, policy: Policy): ProgramMove[];
  canConvert(schools: Record<SchoolId, SchoolState>, school: SchoolId, closures: Closure[]): boolean;
  middleZoneOf(state: GameState, school: SchoolId): SchoolId;
  middleSchoolCandidates(
    schools: Record<SchoolId, SchoolState>,
    school: SchoolId,
    closures: Closure[],
  ): { id: SchoolId; miles: number; kids: number; capacity: number }[];
  conversionChip(state: GameState, change: GradeSpanChange, plan: Policy): ConversionChip;
  plannedZones(state: GameState, policy: Policy): ZoneMap;
  sliceCells(
    state: { households: Household[]; zones: ZoneMap },
    level: ZoneLevel,
    from: SchoolId,
    nearest: SchoolId,
    percent: number,
  ): number[];
  boundaryChip(state: GameState, edit: BoundaryEdit, plan: Policy): BoundaryChip;
  ballotPreview(state: GameState, policy: Policy): BallotPreview | null;
  levyThrough(state: GameState): number;
}

/** One played year. */
export interface Turn {
  start: GameState;
  policy: Policy;
  report: YearReport;
  end: GameState;
}

export interface AppState {
  phase: Phase;
  start: Start;
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
  | { type: 'nextYear' }
  | { type: 'restart'; start: Start; model?: ModelOverrides };

/** A reserve draw is once, so each plan starts with none. */
function draftFor(game: GameState): Policy {
  return { ...game.policy, reserveDraw: 0 };
}

/** A new game, or one replayed through the `saved` plans to the January after them. */
export function initApp(sim: Sim, seed: string, start: Start = 'status-quo', saved: Policy[] = [], model?: ModelOverrides): AppState {
  let game = sim.newGame({ seed, start, model });
  const history: Turn[] = [];
  for (const policy of saved) {
    const { next, report } = sim.endYear(game, policy);
    history.push({ start: game, policy, report, end: next });
    game = next;
  }
  return { phase: 'plan', start, game, draft: draftFor(game), history };
}

export function lastTurn(s: AppState): Turn | undefined {
  return s.history[s.history.length - 1];
}

export const DECIDED: Season[] = ['fall', 'october', 'winter'];

/** Closures take effect in summer and families decide in fall, so the map shows the outcome from then on. */
export function mapState(s: AppState, season: Season): GameState {
  const turn = lastTurn(s);
  if (turn && (s.phase === 'report' || (s.phase === 'playing' && DECIDED.includes(season)))) return turn.end;
  if (turn && s.phase === 'playing' && season === 'summer') return { ...s.game, schools: turn.end.schools };
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
      case 'restart':
        return initApp(sim, s.game.seed, a.start, [], a.model);
    }
  };
}
