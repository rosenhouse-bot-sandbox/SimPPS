import { fmtCount, fmtMoney } from '../format';
import type { Budget } from '../sim/types';
import { Sourced } from './Sourced';
import { K } from './sources';

/** The sim's plan for the draft, pinned above the toolbar. Cuts count June and mid-year. */
export function GapBar({ budget }: { budget: Budget }) {
  return (
    <div class="gapbar" data-testid="gapbar">
      <span>
        Gap <Sourced k={K.gap}>{fmtMoney(budget.gap)}</Sourced>
      </span>
      <span>
        Cuts <Sourced k={K.autoCuts}>{fmtCount(budget.autoCutPositions + budget.midYearCuts)}</Sourced>
      </span>
    </div>
  );
}
