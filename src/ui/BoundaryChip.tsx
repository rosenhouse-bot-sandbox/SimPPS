import { fmtCount, fmtRange } from '../format';
import { modeledRange, type BoundaryChip, type Range } from '../sim';
import { money } from './Chip';
import { nameOf } from './closeSend';
import { Sourced } from './Sourced';
import { K } from './sources';

function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${fmtCount(n)}~`;
}

/** Busing is modeled, so even $0 carries "~". */
function modeled(r: Range): string {
  const s = money(r);
  return s.endsWith('~') ? s : `${s}~`;
}

/** Arithmetic for a boundary edit if every re-zoned kid goes to the new zone school. */
export function BoundaryChipView({ chip, blocks }: { chip: BoundaryChip; blocks: number }) {
  return (
    <div class="chip closure-chip zone-chip" data-testid="boundary-chip">
      <dl>
        <div class="span">
          <dt>Seats</dt>
          {chip.seats.map((s) => (
            <dd key={s.school} class="num seat-row">
              <span>{nameOf(s.school)}</span>
              <span class="seats">
                <Sourced k={K.enrollment}>{fmtRange(s.after)}</Sourced>/<Sourced k={K.capacity}>{fmtCount(s.capacity)}</Sourced>
              </span>
            </dd>
          ))}
        </div>
        <div>
          <dt>Walk at maturity</dt>
          <dd class="num">
            <Sourced k={K.walkK5}>{signed(chip.walk)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>Now</dt>
          <dd class="num">
            <Sourced k={K.busing}>{modeled(chip.now)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>At maturity</dt>
          <dd class="num">
            <Sourced k={K.busing}>{modeled(chip.atMaturity)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>Riders now/later</dt>
          <dd class="num">
            <Sourced k={K.walkLimit}>{signed(chip.riders.now)}</Sourced>/<Sourced k={K.walkLimit}>{signed(chip.riders.atMaturity)}</Sourced>
          </dd>
        </div>
      </dl>
      <p class="pays">
        <Sourced k={K.zoneGrid}>{fmtCount(blocks)}</Sourced> blocks of 250 m,{' '}
        <Sourced k={K.households}>{`${fmtCount(chip.residents)}~`}</Sourced> resident kids.{' '}
        <Sourced k={K.sliceStay}>{chip.kidsMoving ? fmtRange(modeledRange(chip.kidsMoving)) : '0'}</Sourced> kids must move.
      </p>
    </div>
  );
}
