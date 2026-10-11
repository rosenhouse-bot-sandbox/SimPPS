import type { Budget } from '../sim/types';
import { fmtCount, fmtMoney } from '../format';
import { Sourced } from './Sourced';
import { K } from './sources';

/** The sim's plan for the draft, pinned above the toolbar. */
export function GapBar({ budget }: { budget: Budget }) {
  return (
    <div class="gapbar" data-testid="gapbar">
      <span>
        Gap <Sourced k={K.gap}>{fmtMoney(budget.gap)}</Sourced>
      </span>
      <span>
        Cuts <Sourced k={K.autoCuts}>{fmtCount(budget.autoCutPositions)}</Sourced>
      </span>
    </div>
  );
}
