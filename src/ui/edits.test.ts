import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '../sim';
import { ballotItems, fmtLevy, listEdits } from './edits';

describe('edits', () => {
  it('names each change', () => {
    const draft = { ...DEFAULT_POLICY, k5ClassSize: 25, levyRate: 0, reserveDraw: 6e6 };
    expect(listEdits(draft, DEFAULT_POLICY)).toEqual([
      'K-5 class size 24 → 25',
      'Levy $1.99 → lapse',
      'Draw $6M from reserves',
    ]);
    expect(listEdits(DEFAULT_POLICY, DEFAULT_POLICY)).toEqual([]);
  });

  it('sends a new levy rate to voters, but not a lapse', () => {
    expect(ballotItems({ ...DEFAULT_POLICY, levyRate: 1.5 }, DEFAULT_POLICY)).toEqual(['May: levy at $1.50 per $1,000']);
    expect(ballotItems({ ...DEFAULT_POLICY, levyRate: 0 }, DEFAULT_POLICY)).toEqual([]);
    expect(ballotItems(DEFAULT_POLICY, DEFAULT_POLICY)).toEqual([]);
  });

  it('shows a zero levy as a lapse', () => {
    expect(fmtLevy(0)).toBe('lapse');
  });
});
