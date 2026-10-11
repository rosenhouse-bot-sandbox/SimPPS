import { fmtCount, fmtRange } from '../format';
import { modeledRange, type BoundaryChip } from '../sim';
import { money } from './Chip';
import { nameOf } from './closeSend';
import { Sourced } from './Sourced';
import { K } from './sources';

function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${fmtCount(n)}~`;
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
          <dt>Walk</dt>
          <dd class="num">
            <Sourced k={K.walkK5}>{signed(chip.walk)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>Now</dt>
          <dd class="num">
            <Sourced k={K.busing}>{money(chip.now)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>At maturity</dt>
          <dd class="num">
            <Sourced k={K.busReimbursement}>{money(chip.atMaturity)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>Riders</dt>
          <dd class="num">
            <Sourced k={K.walkLimit}>{signed(chip.riders.now)}</Sourced> now, <Sourced k={K.walkLimit}>{signed(chip.riders.atMaturity)}</Sourced> later
          </dd>
        </div>
      </dl>
      <p class="pays">
        <Sourced k={K.zoneGrid}>{fmtCount(blocks)}</Sourced> blocks, <Sourced k={K.zoneGrid}>{`${fmtCount(chip.homes)}~`}</Sourced>{' '}
        homes.{' '}
        <Sourced k={K.sliceStay}>{chip.kidsMoving ? fmtRange(modeledRange(chip.kidsMoving)) : '0'}</Sourced> kids must move.
      </p>
    </div>
  );
}
