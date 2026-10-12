import type { Dials } from '../sim/types';
import { fmtCount, fmtMoney, fmtPct } from '../format';
import type { GlossaryTerm } from './glossary';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Term } from './Term';

interface DialProps {
  term: GlossaryTerm;
  k: string;
  /** The label on a phone. */
  short?: string;
  value: string;
  wide: boolean;
}

/** On a phone, one button whose pop-over defines the dial and sources its value. */
function Dial({ term, k, short = term, value, wide }: DialProps) {
  if (!wide) {
    return (
      <Sourced k={k} term={term} class="dial">
        {`${short} ${value}`}
      </Sourced>
    );
  }
  return (
    <span class="dial">
      <Term t={term}>{short}</Term>{' '}
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
        <Dial term="Gap" k={K.gap} short={gapLabel} value={fmtMoney(dials.gap)} wide={wide} />
      </div>
      <div class="topbar-row">
        <Dial term="Kids" k={K.kids} value={fmtCount(dials.kids)} wide={wide} />
        <Dial term="Capture" k={K.capture} short={wide ? undefined : 'Cap'} value={fmtPct(dials.capture)} wide={wide} />
        <Dial term="Reserves" k={K.reservePct} short={wide ? undefined : 'Res'} value={fmtPct(dials.reservePct)} wide={wide} />
        <Dial term="Trust" k={K.trust} value={String(Math.round(dials.trust))} wide={wide} />
      </div>
    </header>
  );
}
