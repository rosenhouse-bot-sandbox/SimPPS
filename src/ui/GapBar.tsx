import { fmtCount, fmtMoney } from '../format';
import type { Budget } from '../sim/types';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Term } from './Term';

/** The sim's plan for the draft, pinned above the toolbar. Cuts count June and mid-year. */
export function GapBar({ budget }: { budget: Budget }) {
  const term = budget.gap > 0 ? 'Surplus' : 'Gap';
  return (
    <div class="gapbar" data-testid="gapbar">
      <span>
        <Term t={term} />{' '}
        <Sourced k={K.gap} term={term}>
          {fmtMoney(budget.gap)}
        </Sourced>
      </span>
      <span>
        <Term t="Cuts" />{' '}
        <Sourced k={K.autoCuts} term="Cuts">{fmtCount(budget.autoCutPositions + budget.midYearCuts)}</Sourced>
      </span>
    </div>
  );
}
