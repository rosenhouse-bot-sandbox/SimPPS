import type { Range } from '../sim/types';
import { fmtMoney, fmtRange, fmtSignedMoney } from '../format';
import type { Chip as ChipData } from './levers';

function money(r: Range): string {
  if (r.lo === r.hi) return fmtSignedMoney(r.lo);
  return r.lo > 0 ? `+${fmtRange(r, fmtMoney)}` : fmtRange(r, fmtMoney);
}

/** Four cells of arithmetic for one edit. It never predicts family choices. */
export function Chip({ chip }: { chip: ChipData }) {
  const cells: [string, string][] = [
    ['Seats', chip.seats],
    ['Walk', chip.walk],
    ['Now', money(chip.now)],
    ['At maturity', money(chip.atMaturity)],
  ];
  return (
    <dl class="chip">
      {cells.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd class="num">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
