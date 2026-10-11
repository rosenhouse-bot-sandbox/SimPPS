import type { Dials } from '../sim/types';
import { fmtCount, fmtMoney, fmtPct } from './format';
import { Sourced } from './Sourced';
import { K } from './sources';

export function TopBar({ when, dials }: { when: string; dials: Dials }) {
  return (
    <header class="topbar">
      <div class="topbar-row">
        <Sourced k={K.calendar}>{when}</Sourced>
        <span>
          Gap <Sourced k={K.gap}>{fmtMoney(dials.gap)}</Sourced>
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
      </div>
    </header>
  );
}
