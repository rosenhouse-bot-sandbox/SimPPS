import { fmtCount, fmtRange } from '../format';
import { modeledRange, type BoundaryChip, type Range } from '../sim';
import { money } from './Chip';
import { nameOf } from './closeSend';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Term } from './Term';

function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${fmtCount(n)}~`;
}

/** Busing is modeled, so even $0 carries "~". */
function modeled(r: Range): string {
  const s = money(r);
  return s.endsWith('~') ? s : `${s}~`;
}

type Seat = BoundaryChip['seats'][number];

function Seats({ title, chip, kids }: { title: string; chip: BoundaryChip; kids: (s: Seat) => Range }) {
  return (
    <div class="span">
      <dt>
        <Term t="Seats">{title}</Term>
      </dt>
      {chip.seats.map((s) => (
        <dd key={s.school} class="num seat-row">
          <span>{nameOf(s.school)}</span>
          <span class="seats">
            <Sourced k={K.enrollment}>{fmtRange(kids(s))}</Sourced>/<Sourced k={K.capacity}>{fmtCount(s.capacity)}</Sourced>
          </span>
        </dd>
      ))}
    </div>
  );
}

/** Arithmetic for a boundary edit if every re-zoned kid goes to the new zone school. */
export function BoundaryChipView({ chip, blocks }: { chip: BoundaryChip; blocks: number }) {
  return (
    <div class="chip closure-chip zone-chip" data-testid="boundary-chip">
      <dl>
        <Seats title="Seats" chip={chip} kids={(s) => s.after} />
        {chip.seats.some((s) => s.mature.lo !== s.after.lo || s.mature.hi !== s.after.hi) && (
          <Seats title="Seats at maturity" chip={chip} kids={(s) => s.mature} />
        )}
        <div>
          <dt>
            <Term t="K-5 walkers" /> at maturity
          </dt>
          <dd class="num">
            <Sourced k={K.walkK5} term="K-5 walkers">{signed(chip.walk)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>
            <Term t="Now" />
          </dt>
          <dd class="num">
            <Sourced k={K.busing} term="Now">{modeled(chip.now)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>
            <Term t="At maturity" />
          </dt>
          <dd class="num">
            <Sourced k={K.busing} term="At maturity">{modeled(chip.atMaturity)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>
            <Term t="New bus riders">Riders</Term> now/later
          </dt>
          <dd class="num">
            <Sourced k={K.newBusRiders}>{signed(chip.riders.now)}</Sourced>/<Sourced k={K.newBusRiders}>{signed(chip.riders.atMaturity)}</Sourced>
          </dd>
        </div>
      </dl>
      <p class="pays">
        <Sourced k={K.zoneGrid}>{fmtCount(blocks)}</Sourced> <Term t="Blocks">blocks</Term> of 250 m,{' '}
        <Sourced k={K.households}>{`${fmtCount(chip.residents)}~`}</Sourced> resident kids.{' '}
        <Sourced k={K.sliceStay}>{chip.kidsMoving ? fmtRange(modeledRange(chip.kidsMoving)) : '0'}</Sourced> kids must move.
      </p>
    </div>
  );
}
