import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '../sim';
import type { Closure } from '../sim/types';
import { ballotItems, fmtLevy, listEdits } from './edits';

describe('edits', () => {
  it('names and sources each change', () => {
    const draft = { ...DEFAULT_POLICY, k5ClassSize: 25, levyRate: 0, reserveDraw: 6e6 };
    expect(listEdits(draft, DEFAULT_POLICY)).toEqual([
      { text: 'K-5 class size 24 → 25', sourceKey: 'ui.k5ClassSize', undo: { k5ClassSize: 24 } },
      { text: 'Levy $1.99 → lapse', sourceKey: 'model.levy', undo: { levyRate: 1.99 } },
      { text: 'Draw $6M from reserves', sourceKey: 'ui.reserveDraw', undo: { reserveDraw: 0 } },
    ]);
    expect(listEdits(DEFAULT_POLICY, DEFAULT_POLICY)).toEqual([]);
  });

  it('lists every closure in the plan, even one the start loaded, with an undo that drops only it', () => {
    const peninsula: Closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' };
    const maplewood: Closure = {
      school: 'maplewood',
      receivers: [
        { school: 'hayhurst', share: 0.7 },
        { school: 'rieke', share: 0.3 },
      ],
      building: 'sell',
    };
    const draft = { ...DEFAULT_POLICY, closures: [peninsula, maplewood] };
    expect(listEdits(draft, draft)).toEqual([
      { text: 'Close Peninsula → Rosa Parks', sourceKey: 'model.closureSavings', undo: { closures: [maplewood] } },
      { text: 'Close Maplewood → Hayhurst 70%, Rieke 30% · sold', sourceKey: 'model.closureSavings', undo: { closures: [peninsula] } },
    ]);
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
