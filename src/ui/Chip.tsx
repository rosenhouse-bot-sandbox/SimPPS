import type { Range } from '../sim/types';
import { fmtMoney, fmtRange, fmtSignedMoney } from '../format';
import type { Chip as ChipData } from './levers';
import type { GlossaryTerm } from './glossary';
import { Sourced } from './Sourced';
import { Term } from './Term';

export function money(r: Range): string {
  if (r.lo === r.hi) return fmtSignedMoney(r.lo);
  return r.lo > 0 ? `+${fmtRange(r, fmtMoney)}` : fmtRange(r, fmtMoney);
}

/** Four cells of arithmetic for one edit. It never predicts family choices. */
export function Chip({ chip, sourceKey }: { chip: ChipData; sourceKey: string }) {
  const cells: [GlossaryTerm, string][] = [
    ['Seats', chip.seats],
    ['Walk', chip.walk],
    ['Now', money(chip.now)],
    ['At maturity', money(chip.atMaturity)],
  ];
  return (
    <dl class="chip">
      {cells.map(([k, v]) => (
        <div key={k}>
          <dt>{v === '—' ? k : <Term t={k} />}</dt>
          <dd class="num">
            {v === '—' ? (
              v
            ) : (
              <Sourced k={sourceKey} term={k}>
                {v}
              </Sourced>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
