import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { BallotItem, ballotText } from './Ballot';

afterEach(cleanup);

const poll = { lo: 0.7, hi: 0.8 };

describe('BallotItem', () => {
  it('names the month, the measure and the poll range, each sourced', () => {
    render(<BallotItem ballot={{ rate: 1.8, when: 'may', renewal: false, poll }} year={2027} />);
    const sources = [...document.querySelectorAll('[data-source]')];
    expect(sources.map((e) => e.textContent)).toEqual(['May 2027: levy at $1.80 per $1,000', '70–80%~']);
    expect(sources.map((e) => e.getAttribute('data-source'))).toEqual(['model.election', 'model.election']);
    expect(document.body.textContent).toBe('May 2027: levy at $1.80 per $1,000 · poll 70–80%~');
  });

  it('says renew for a renewal and dates November', () => {
    expect(ballotText({ rate: 1.99, when: 'november', renewal: true, poll }, 2029)).toBe('Nov 2029: renew the levy at $1.99 per $1,000');
  });
});
