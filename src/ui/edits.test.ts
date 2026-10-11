import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '../sim';
import { ballotItems, fmtLevy, listEdits } from './edits';

describe('edits', () => {
  it('names and sources each change', () => {
    const draft = { ...DEFAULT_POLICY, k5ClassSize: 25, levyRate: 0, reserveDraw: 6e6 };
    expect(listEdits(draft, DEFAULT_POLICY)).toEqual([
      { text: 'K-5 class size 24 → 25', sourceKey: 'ui.k5ClassSize' },
      { text: 'Levy $1.99 → lapse', sourceKey: 'model.levy' },
      { text: 'Draw $6M from reserves', sourceKey: 'ui.reserveDraw' },
    ]);
    expect(listEdits(DEFAULT_POLICY, DEFAULT_POLICY)).toEqual([]);
  });

  it('sends a new levy rate to voters and assumes it passes, but not a lapse', () => {
    expect(ballotItems({ ...DEFAULT_POLICY, levyRate: 1.5 }, DEFAULT_POLICY)).toEqual([
      { text: 'May: levy at $1.50 per $1,000, assumed to pass', sourceKey: 'model.levy' },
    ]);
    expect(ballotItems({ ...DEFAULT_POLICY, levyRate: 0 }, DEFAULT_POLICY)).toEqual([]);
    expect(ballotItems(DEFAULT_POLICY, DEFAULT_POLICY)).toEqual([]);
  });

  it('shows a zero levy as a lapse', () => {
    expect(fmtLevy(0)).toBe('lapse');
  });
});
