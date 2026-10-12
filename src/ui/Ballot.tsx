import type { BallotPreview } from '../sim';
import type { Range } from '../sim/types';
import { Sourced } from './Sourced';
import { K } from './sources';

const MONTH = { may: 'May', november: 'Nov' } as const;

export function ballotText(b: BallotPreview, year: number): string {
  return `${MONTH[b.when]} ${year} levy ${b.renewal ? 'renewal' : 'vote'}`;
}

/** A yes share range, like "70–80%~". */
export function fmtShareRange(r: Range): string {
  return `${Math.round(r.lo * 100)}–${Math.round(r.hi * 100)}%~`;
}

/** Two lines of at most 28 characters. */
export function BallotItem({ ballot, year }: { ballot: BallotPreview; year: number }) {
  return (
    <>
      <span class="line">
        <Sourced k={K.election} text>
          {ballotText(ballot, year)}
        </Sourced>
      </span>
      <span class="line">
        {`$${ballot.rate.toFixed(2)} per $1K · poll `}
        <Sourced k={K.election}>{fmtShareRange(ballot.poll)}</Sourced>
      </span>
    </>
  );
}
