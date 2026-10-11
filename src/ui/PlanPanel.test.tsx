import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_POLICY, SCENARIOS } from '../sim';
import type { Closure } from '../sim/types';
import { PlanPanel } from './PlanPanel';

afterEach(cleanup);

const peninsula: Closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' };

function setup(start: 'status-quo' | 'scenario-a' = 'status-quo') {
  const onEdit = vi.fn();
  const draft = { ...DEFAULT_POLICY, k5ClassSize: 25, closures: [peninsula] };
  render(<PlanPanel draft={draft} base={DEFAULT_POLICY} start={start} onEdit={onEdit} onSelectSchool={() => {}} onClose={() => {}} />);
  return onEdit;
}

describe('PlanPanel', () => {
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
});
