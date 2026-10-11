import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '../sim';
import { BudgetPanel } from './BudgetPanel';
import { FIXTURE_GAME } from './fixtures';

afterEach(cleanup);

const shortfall = {
  ...FIXTURE_GAME.budget,
  gap: -17_500_000,
  reserveDraw: 17_500_000,
  autoCutPositions: 0,
  reservesAfter: 23_600_000,
  reservePctAfterDraw: 0.0285,
  midYearCuts: 12,
};

function setup() {
  const draft = { ...DEFAULT_POLICY, reserveDraw: 26_000_000 };
  render(<BudgetPanel game={FIXTURE_GAME} draft={draft} plan={shortfall} onEdit={() => {}} onClose={() => {}} />);
}

describe('BudgetPanel', () => {
  it('shows and caps the reserve draw at the shortfall the sim applies', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Reserve draw' });
    expect(group.querySelector('.stepper-value')!.textContent).toBe('$17.5M');
    expect((screen.getByRole('button', { name: 'More Reserve draw' }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('.chip')!.textContent).toContain('Now+$17.5M');
  });

  it('warns when the draw breaches the 5% policy and forces mid-year cuts', () => {
    setup();
    const note = screen.getByText(/Reserves after/).closest('.note')!.textContent;
    expect(note).toBe('Reserves after: $23.6M, 2.9%');
    expect(screen.getByText(/Below 5%/).textContent).toBe('Below 5% breaches policy.');
    expect(screen.getByText(/mid-year/).textContent).toBe('Below 3%: 12 positions cut mid-year.');
  });
});
