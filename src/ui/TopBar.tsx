import type { ComponentChildren } from 'preact';
import type { Dials } from '../sim/types';
import { fmtCount, fmtMoney, fmtPct } from '../format';
import type { GlossaryTerm } from './glossary';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Term } from './Term';

function Dial({ term, k, label, value }: { term: GlossaryTerm; k: string; label?: ComponentChildren; value: string }) {
  return (
    <span class="dial">
      <Term t={term}>{label}</Term>{' '}
      <Sourced k={k} term={term}>
        {value}
      </Sourced>
    </span>
  );
}

/** `gapLabel` names the plan's year when it is not the one in `when`. `wide` spells out short labels. */
export function TopBar({ when, dials, gapLabel, wide = false }: { when: string; dials: Dials; gapLabel?: string; wide?: boolean }) {
  return (
    <header class="topbar">
      <div class="topbar-row">
        <Sourced k={K.calendar}>{when}</Sourced>
        <Dial term="Gap" k={K.gap} label={gapLabel} value={fmtMoney(dials.gap)} />
      </div>
      <div class="topbar-row">
        <Dial term="Kids" k={K.kids} value={fmtCount(dials.kids)} />
        <Dial term="Capture" k={K.capture} label={wide ? undefined : 'Cap'} value={fmtPct(dials.capture)} />
        <Dial term="Reserves" k={K.reservePct} label={wide ? undefined : 'Res'} value={fmtPct(dials.reservePct)} />
        <Dial term="Trust" k={K.trust} value={String(Math.round(dials.trust))} />
      </div>
    </header>
  );
}
