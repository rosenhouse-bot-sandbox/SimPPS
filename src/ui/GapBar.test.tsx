import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { FIXTURE_GAME } from './fixtures';
import { GapBar } from './GapBar';
import { termsIn } from './terms.testing';

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

describe('GapBar glossary', () => {
  it('defines the gap or surplus and the cuts', () => {
    render(<GapBar budget={FIXTURE_GAME.budget} />);
    expect(termsIn()).toEqual(['Gap', 'Cuts']);
    cleanup();
    render(<GapBar budget={{ ...FIXTURE_GAME.budget, gap: 1_000_000 }} />);
    expect(termsIn()).toEqual(['Surplus', 'Cuts']);
  });
});
