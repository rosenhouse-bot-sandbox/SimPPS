import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '../sim';
import { FIXTURE_GAME } from './fixtures';
import { PreflightSheet } from './PreflightSheet';

afterEach(cleanup);

function sheet(year: number) {
  const noop = () => {};
  render(<PreflightSheet year={year} draft={DEFAULT_POLICY} base={DEFAULT_POLICY} budget={FIXTURE_GAME.budget} onBack={noop} onConfirm={noop} />);
  return screen.getByRole('region', { name: /^Play/ }).textContent;
}

describe('PreflightSheet', () => {
  it('warns that odd-year plans assume flat state funding', () => {
    expect(sheet(2029)).toContain('At flat state funding.');
    cleanup();
    expect(sheet(2028)).not.toContain('flat state funding');
  });
});
