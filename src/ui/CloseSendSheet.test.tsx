import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fmtCount, fmtMoneyRange, fmtRange } from '../format';
import { closureChip, modeledRange, newGame, receiverCandidates } from '../sim';
import type { Closure } from '../sim/types';
import { startDraft, withNames, type CloseDraft } from './closeSend';
import { CloseSendSheet } from './CloseSendSheet';
import { termsIn } from './terms.testing';

afterEach(cleanup);

const game = newGame({ seed: 'p52' });

function setup(school = 'peninsula', plan: Closure[] = [], existing?: Closure) {
  const onCommit = vi.fn();
  const onClose = vi.fn();
  const candidates = withNames(receiverCandidates(game.schools, school, plan));
  function Harness() {
    const [d, setD] = useState<CloseDraft>(startDraft(school, existing));
    return (
      <CloseSendSheet
        draft={d}
        candidates={candidates}
        chipFor={(c) => closureChip(game, c, plan, 24)}
        onChange={setD}
        onCommit={onCommit}
        onClose={onClose}
      />
    );
  }
  render(<Harness />);
  return { onCommit, onClose };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const chip = () => screen.getByTestId('closure-chip');
const picks = () => [...document.querySelectorAll('.pick-name')].map((b) => b.textContent!.slice(1));

describe('CloseSendSheet', () => {
  it('says a dual-language program moves with the closure', () => {
    setup('james-john');
    const note = screen.getByText(/DLI/);
    expect(note.textContent).toBe('Its Spanish dual-language (DLI) program moves with it.');
    expect(note.closest('[data-source]')!.getAttribute('data-source')).toBe('model.programMove');
    cleanup();
    setup('peninsula');
    expect(screen.queryByText(/DLI/)).toBeNull();
  });

  it('lists the nearest open schools first, with sourced distance and seats', () => {
    setup();
    expect(picks()[0]).toBe('Rosa Parks');
    expect(picks()).toHaveLength(5);
    const row = screen.getByRole('button', { name: /Rosa Parks/ }).closest('li')!;
    expect(row.textContent).toBe(`□Rosa Parks0.7 mi${fmtRange(modeledRange(game.schools['rosa-parks'].enrollment))}/594`);
    expect([...row.querySelectorAll('[data-source]')].map((e) => e.getAttribute('data-source'))).toEqual([
      'ui.distance',
      'model.schoolRange',
      'field.functional_capacity_model',
    ]);
  });

  it('offers every candidate A–Z as the menu path', () => {
    setup();
    click('All schools A–Z');
    expect(picks().length).toBeGreaterThan(20);
    expect(picks()).toEqual([...picks()].sort((a, b) => a.localeCompare(b)));
    expect(picks()).not.toContain('Peninsula');
  });

  it('needs a receiver before step 2', () => {
    setup();
    expect((screen.getByRole('button', { name: 'Next >' }) as HTMLButtonElement).disabled).toBe(true);
    click(/Rosa Parks/);
    expect(screen.getByRole('button', { name: /Rosa Parks/ }).getAttribute('aria-pressed')).toBe('true');
    click('Next >');
    expect(screen.getByText('2 of 3')).toBeTruthy();
  });

  it('shows the chip for one receiver: seats, walk, now, at maturity and pays off', () => {
    setup();
    click(/Rosa Parks/);
    click('Next >');
    const c = closureChip(game, { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' }, [], 24);
    expect(c.seats.kids).toBe(399);
    const cells = [...chip().querySelectorAll('dt')].map((dt) => `${dt.textContent} ${dt.nextElementSibling!.textContent}`);
    expect(c.busRiders).toBeGreaterThan(0);
    expect(cells).toEqual(['Seats 377–421~/594', 'Walk +0.5 mi~', `Now ${fmtMoneyRange(c.now)}`, `At maturity, 2029 ${fmtMoneyRange(c.atMaturity)}`]);
    const pays = chip().querySelector('.pays')!;
    expect(pays.textContent).toBe(`Pays off if fewer than ${fmtCount(c.paysOffIfFewerThan)}~ leave PPS. ${fmtCount(c.busRiders)}~ new bus riders`);
    expect([...pays.querySelectorAll('[data-source]')].map((e) => e.getAttribute('data-source'))).toEqual(['ui.paysOff', 'model.busing']);
    expect(screen.getByText('Rosa Parks').closest('.row')!.textContent).toBe('Rosa Parks100%');
  });

  it('says where a closing DLI school\'s program goes', () => {
    setup('richmond');
    click(/Glencoe/);
    click('Next >');
    const line = chip().querySelector('.programs')!;
    expect(line.textContent).toBe('Japanese DLI moves to Glencoe.');
    expect(line.querySelector('[data-source]')!.getAttribute('data-source')).toBe('model.programMove');
  });

  it('splits two receivers 70/30 by default and steps the split', () => {
    setup('maplewood');
    click(/Hayhurst/);
    click(/Rieke/);
    click('Next >');
    expect(screen.getByRole('group', { name: 'Hayhurst' }).textContent).toContain('70%');
    expect(screen.getByText('Rieke').closest('.row')!.textContent).toBe('Rieke30%');
    click('More Hayhurst');
    expect(screen.getByText('Rieke').closest('.row')!.textContent).toBe('Rieke20%');
  });

  it('warns before selling, commits at step 3 and takes an optional guess', () => {
    const { onCommit, onClose } = setup();
    click(/Rosa Parks/);
    click('Next >');
    click('Next >');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Sell/ }));
    expect(screen.getByRole('alert').textContent).toContain("can't reopen");
    click('Close it');
    const sold: Closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'sell' };
    expect(onCommit).toHaveBeenLastCalledWith(sold);
    const moving = closureChip(game, sold, [], 24).kidsMoving;
    expect(within(screen.getByRole('group', { name: 'Stay in PPS' })).getByRole('status').textContent).toBe(fmtCount(moving));
    click('Less Stay in PPS');
    click('Call it');
    expect(onCommit).toHaveBeenLastCalledWith({ ...sold, guess: Math.ceil(moving / 5) * 5 - 5 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('skips the guess', () => {
    const { onCommit, onClose } = setup();
    click(/Rosa Parks/);
    click('Next >');
    click('Next >');
    click('Close it');
    click('Skip');
    expect(onCommit).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the guess of a closure being changed when the player skips', () => {
    const existing: Closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball', guess: 150 };
    const { onCommit } = setup('peninsula', [existing], existing);
    click('Next >');
    click('Next >');
    click('Close it');
    expect(within(screen.getByRole('group', { name: 'Stay in PPS' })).getByRole('status').textContent).toBe('150');
    click('Skip');
    expect(onCommit).toHaveBeenLastCalledWith(existing);
  });

  it('does not offer schools closing elsewhere in the plan', () => {
    setup('peninsula', [{ school: 'rosa-parks', receivers: [{ school: 'sitton', share: 1 }], building: 'mothball' }]);
    expect(picks()).not.toContain('Rosa Parks');
  });
});

describe('CloseSendSheet glossary', () => {
  it('defines each step, building fate and chip cell', () => {
    setup();
    expect(termsIn()).toEqual(['Send kids to']);
    click(/Rosa Parks/);
    click('Next >');
    expect(termsIn()).toEqual(expect.arrayContaining(['Shares', 'Seats', 'Walk', 'Now', 'At maturity', 'Pays off']));
    click('Next >');
    expect(termsIn().slice(0, 4)).toEqual(['Building', 'Mothball', 'Lease', 'Sell']);
    click('Close it');
    expect(termsIn()).toEqual(['Call it']);
  });

  it('puts each fate\'s mark next to its name', () => {
    setup();
    click(/Rosa Parks/);
    click('Next >');
    click('Next >');
    for (const fate of document.querySelectorAll('.fate')) expect(termsIn(fate)).toEqual([fate.textContent]);
  });
});
