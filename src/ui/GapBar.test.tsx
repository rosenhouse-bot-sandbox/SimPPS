import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { FIXTURE_GAME } from './fixtures';
import { GapBar } from './GapBar';

afterEach(cleanup);

describe('GapBar', () => {
  it('calls a positive gap a surplus', () => {
    render(<GapBar budget={{ ...FIXTURE_GAME.budget, gap: 77_200_000, autoCutPositions: 0, midYearCuts: 0 }} />);
    expect(screen.getByTestId('gapbar').textContent).toBe('Surplus $77.2MCuts 0');
    cleanup();
    render(<GapBar budget={{ ...FIXTURE_GAME.budget, gap: -5_000_000, autoCutPositions: 33, midYearCuts: 0 }} />);
    expect(screen.getByTestId('gapbar').textContent).toBe('Gap −$5MCuts 33');
  });
});
