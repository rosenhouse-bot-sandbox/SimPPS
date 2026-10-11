import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, type BallotPreview } from '../sim';
import { FIXTURE_GAME } from './fixtures';
import { PreflightSheet } from './PreflightSheet';

afterEach(cleanup);

function sheet(year: number, ballot: BallotPreview | null = null) {
  const noop = () => {};
  render(
    <PreflightSheet
      year={year}
      draft={DEFAULT_POLICY}
      base={DEFAULT_POLICY}
      budget={FIXTURE_GAME.budget}
      ballot={ballot}
      onBack={noop}
      onConfirm={noop}
    />,
  );
  return screen.getByRole('region', { name: /^Play/ }).textContent;
}

describe('PreflightSheet', () => {
  it('lists the ballot item with its poll, booked as passing', () => {
    const text = sheet(2030, { rate: 1.99, when: 'may', renewal: true, poll: { lo: 0.72, hi: 0.82 } });
    expect(text).toContain('BallotMay 2030: renew the levy at $1.99 per $1,000 · poll 72–82%~');
    expect(text).toContain('The plan books it as passing.');
    cleanup();
    expect(sheet(2029, { rate: 1.99, when: 'november', renewal: true, poll: { lo: 0.72, hi: 0.82 } })).not.toContain('books it');
    cleanup();
    expect(sheet(2027)).toContain('BallotNone');
  });

  it('warns that odd-year plans assume flat state funding', () => {
    expect(sheet(2029)).toContain('At flat state funding.');
    cleanup();
    expect(sheet(2028)).not.toContain('flat state funding');
  });
});
