import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fmtSignedMoney } from '../format';
import { DEFAULT_POLICY, levyRevenue, type BallotPreview, type Policy } from '../sim';
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

function setup(opts: { ballot?: BallotPreview | null; levyThrough?: number; draft?: Partial<Policy> } = {}) {
  const draft = { ...DEFAULT_POLICY, reserveDraw: 26_000_000, ...opts.draft };
  const onEdit = vi.fn();
  render(
    <BudgetPanel
      game={FIXTURE_GAME}
      draft={draft}
      plan={shortfall}
      ballot={opts.ballot ?? null}
      levyThrough={opts.levyThrough ?? 2029}
      onEdit={onEdit}
      onClose={() => {}}
    />,
  );
  return onEdit;
}

const ballot: BallotPreview = { rate: 1.8, when: 'may', renewal: false, poll: { lo: 0.62, hi: 0.72 } };

describe('BudgetPanel levy', () => {
  it('says when the levy runs out', () => {
    setup();
    const note = screen.getByText(/Levy runs through/);
    expect(note.textContent).toBe('Levy runs through June 2030');
    expect(note.closest('[data-source]')!.getAttribute('data-source')).toBe('model.levyTerm');
    cleanup();
    setup({ levyThrough: 2025 });
    expect(screen.getByText(/Levy expired/).textContent).toBe('Levy expired June 2026');
  });

  it('says the levy expires, not expired, in January of its last June', () => {
    setup({ levyThrough: 2026 });
    expect(screen.getByText(/Levy expires/).textContent).toBe('Levy expires June 2027');
  });

  it('says a lapse ends the levy this June', () => {
    setup({ draft: { levyRate: 0 } });
    expect(screen.getByText(/Levy lapses/).textContent).toBe('Levy lapses after June 2027');
  });

  it('steps back to $1.99 after a lapse', () => {
    const onEdit = vi.fn();
    const lapsed = { ...FIXTURE_GAME, policy: { ...FIXTURE_GAME.policy, levyRate: 0 } };
    render(
      <BudgetPanel game={lapsed} draft={{ ...DEFAULT_POLICY, levyRate: 1.89 }} plan={shortfall} ballot={null} levyThrough={2026} onEdit={onEdit} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More Levy rate' }));
    expect(onEdit).toHaveBeenLastCalledWith({ levyRate: 1.99 });
  });

  it('shows the ballot item with its poll and lets it move to November', () => {
    const onEdit = setup({ ballot, draft: { levyRate: 1.8 } });
    const item = screen.getByRole('group', { name: 'Levy ballot' });
    expect(item.textContent).toContain('May 2027 levy vote$1.80 per $1K · poll 62–72%~');
    fireEvent.click(screen.getByRole('radio', { name: 'November' }));
    expect(onEdit).toHaveBeenLastCalledWith({ levyElection: 'november' });
  });

  it('offers a November renewal in the last funded year only', () => {
    setup();
    expect(screen.queryByRole('group', { name: 'Levy ballot' })).toBeNull();
    cleanup();
    setup({ levyThrough: 2027 });
    expect(screen.getByRole('radio', { name: 'May' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Levy ballot' }).textContent).toContain('No vote this year.');
  });

  it('prices a new rate net of its election bill', () => {
    const plan = { ...shortfall, lines: [{ key: 'election', label: 'Election bill', amount: -500_000, sourceKey: 'model.electionBill' }] };
    render(
      <BudgetPanel game={FIXTURE_GAME} draft={{ ...DEFAULT_POLICY, levyRate: 0.99 }} plan={plan} ballot={ballot} levyThrough={2029} onEdit={() => {}} onClose={() => {}} />,
    );
    const chip = document.querySelector('.chip')!.textContent!;
    expect(chip).toContain(`Now${fmtSignedMoney(levyRevenue(0.99) - levyRevenue(1.99) - 500_000)}`);
    const bill = screen.getByText(/Election bill/).closest('.note')!;
    expect(bill.textContent).toBe('Election bill: −$500K');
    expect(bill.querySelector('[data-source]')!.getAttribute('data-source')).toBe('model.electionBill');
    expect(document.querySelector('.chip [data-source]')!.getAttribute('data-source')).toBe('model.levyRate');
  });

  it('books only the election bill now when the vote is in November', () => {
    const plan = { ...shortfall, lines: [{ key: 'election', label: 'Election bill', amount: -500_000, sourceKey: 'model.electionBill' }] };
    render(
      <BudgetPanel
        game={FIXTURE_GAME}
        draft={{ ...DEFAULT_POLICY, levyRate: 0.99, levyElection: 'november' }}
        plan={plan}
        ballot={{ ...ballot, rate: 0.99, when: 'november' }}
        levyThrough={2029}
        onEdit={() => {}}
        onClose={() => {}}
      />,
    );
    expect(document.querySelector('.chip')!.textContent).toContain('Now−$500K');
  });
});

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
