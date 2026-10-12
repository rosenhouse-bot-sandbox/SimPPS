import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_POLICY, SCENARIOS } from '../sim';
import type { Closure } from '../sim/types';
import { calendarItems } from './calendar';
import { PlanPanel } from './PlanPanel';

afterEach(cleanup);

const peninsula: Closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' };

function setup(start: 'status-quo' | 'scenario-a' = 'status-quo', onEditBoundary?: () => void) {
  const onEdit = vi.fn();
  const draft = { ...DEFAULT_POLICY, k5ClassSize: 25, closures: [peninsula] };
  render(
    <PlanPanel
      draft={draft}
      base={DEFAULT_POLICY}
      start={start}
      onEdit={onEdit}
      onSelectSchool={() => {}}
      onEditBoundary={onEditBoundary}
      calendar={calendarItems(2027, 2029)}
      ballot={{ rate: 1.8, when: 'may', renewal: false, poll: { lo: 0.62, hi: 0.72 } }}
      year={2027}
      onClose={() => {}}
    />,
  );
  return onEdit;
}

describe('PlanPanel', () => {
  it('shows the calendar strip, each item sourced', () => {
    setup();
    const strip = screen.getByRole('list', { name: 'Calendar' });
    const items = [...strip.querySelectorAll('li')];
    expect(items.map((li) => li.textContent)).toEqual([
      'JAN 2027Teacher bargaining opens',
      'SPR 2027Legislature sets the 2027-29 budget',
      'JUN 2030Levy expires',
    ]);
    expect(items.map((li) => li.querySelector('[data-source]')!.getAttribute('data-source'))).toEqual([
      'ui.bargaining',
      'model.stateFunding',
      'model.levyTerm',
    ]);
  });

  it('shows the ballot item with its poll', () => {
    setup();
    expect(document.querySelector('.ballot')!.textContent).toBe('May 2027 levy vote$1.80 per $1K · poll 62–72%~');
  });

  it('lists each edit as sourced text with an Undo', () => {
    const onEdit = setup();
    const items = [...document.querySelectorAll('.edits li')];
    expect(items.map((li) => li.querySelector('[data-source]')!.textContent)).toEqual([
      'Close Peninsula → Rosa Parks',
      'K-5 class size 24 → 25',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Undo Close Peninsula → Rosa Parks' }));
    expect(onEdit).toHaveBeenLastCalledWith({ closures: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Undo K-5 class size 24 → 25' }));
    expect(onEdit).toHaveBeenLastCalledWith({ k5ClassSize: 24 });
  });

  it("badges what a scenario start doesn't model", () => {
    setup('scenario-a');
    expect(screen.getByText(SCENARIOS['scenario-a'].notModeled!)).toBeTruthy();
    cleanup();
    setup();
    expect(screen.queryByText(/Not modeled/)).toBeNull();
  });

  it('opens Zone mode from Edit boundary', () => {
    const onEditBoundary = vi.fn();
    setup('status-quo', onEditBoundary);
    fireEvent.click(screen.getByRole('button', { name: 'Edit boundary' }));
    expect(onEditBoundary).toHaveBeenCalled();
  });
});
