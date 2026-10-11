import type { GameState } from './types';

/** A rich levy already approved, so a test plays without cuts or a vote. */
export function richLevy(state: GameState, rate = 5): GameState {
  return { ...state, policy: { ...state.policy, levyRate: rate }, sim: { ...state.sim!, levy: { ...state.sim!.levy, rate } } };
}
