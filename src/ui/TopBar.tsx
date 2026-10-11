import type { Dials } from '../sim/types';
import { fmtCount, fmtMoney, fmtPct } from '../format';
import { Sourced } from './Sourced';
import { K } from './sources';

/** `gapLabel` names the plan's year when it is not the one in `when`. */
export function TopBar({ when, dials, gapLabel = 'Gap' }: { when: string; dials: Dials; gapLabel?: string }) {
  return (
    <header class="topbar">
      <div class="topbar-row">
        <Sourced k={K.calendar}>{when}</Sourced>
        <span>
          {gapLabel} <Sourced k={K.gap}>{fmtMoney(dials.gap)}</Sourced>
        </span>
      </div>
      <div class="topbar-row">
        <span>
          Kids <Sourced k={K.kids}>{fmtCount(dials.kids)}</Sourced>
        </span>
        <span>
          Cap <Sourced k={K.capture}>{fmtPct(dials.capture)}</Sourced>
        </span>
        <span>
          Res <Sourced k={K.reservePct}>{fmtPct(dials.reservePct)}</Sourced>
        </span>
        <span>
          Trust <Sourced k={K.trust}>{String(Math.round(dials.trust))}</Sourced>
        </span>
      </div>
    </header>
  );
}
