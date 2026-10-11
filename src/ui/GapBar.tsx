import type { Range } from '../sim/types';
import { fmtMoney, fmtRange } from './format';
import { autoCutPositions, midpoint } from './levers';
import { Sourced } from './Sourced';
import { K } from './sources';

export function fmtGap(gap: Range): string {
  return gap.lo === gap.hi ? fmtMoney(gap.lo) : fmtRange(gap, fmtMoney);
}

/** The draft's gap, pinned above the toolbar. */
export function GapBar({ gap }: { gap: Range }) {
  const cuts = autoCutPositions(midpoint(gap));
  return (
    <div class="gapbar" data-testid="gapbar">
      <span>
        Gap <Sourced k={K.gap}>{fmtGap(gap)}</Sourced>
      </span>
      <span>
        Cuts{' '}
        <Sourced k={K.autoCuts} modeled>
          {cuts}
        </Sourced>
      </span>
    </div>
  );
}
