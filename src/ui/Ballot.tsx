import type { BallotPreview } from '../sim';
import type { Range } from '../sim/types';
import { Sourced } from './Sourced';
import { K } from './sources';

const MONTH = { may: 'May', november: 'Nov' } as const;

export function ballotText(b: BallotPreview, year: number): string {
  const rate = `$${b.rate.toFixed(2)} per $1,000`;
  return `${MONTH[b.when]} ${year}: ${b.renewal ? `renew the levy at ${rate}` : `levy at ${rate}`}`;
}

/** A yes share range, like "70–80%~". */
export function fmtShareRange(r: Range): string {
  return `${Math.round(r.lo * 100)}–${Math.round(r.hi * 100)}%~`;
}

export function BallotItem({ ballot, year }: { ballot: BallotPreview; year: number }) {
  return (
    <>
      <Sourced k={K.election} text>
        {ballotText(ballot, year)}
      </Sourced>
      {' · poll '}
      <Sourced k={K.election}>{fmtShareRange(ballot.poll)}</Sourced>
    </>
  );
}
