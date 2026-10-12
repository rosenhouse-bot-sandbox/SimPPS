import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fmtRange } from '../format';
import { boundaryChip, newGame, sliceCells, type BoundaryChip } from '../sim';
import type { BoundaryEdit } from '../sim/types';
import { addStroke, draftCells, sliceSources, startZoneDraft, targets, toEdit, type ZoneDraft } from './zoneEdit';
import { ZoneSheet } from './ZoneSheet';
import { termsIn } from './terms.testing';

afterEach(cleanup);

const game = newGame({ seed: 'p52' });
const peninsula = sliceCells(game, 'elementary', 'peninsula', 'rosa-parks', 30);

function setup(initial: ZoneDraft = startZoneDraft('elementary', 'rosa-parks'), chipOverride?: Partial<BoundaryChip>) {
  const onCommit = vi.fn();
  const onClose = vi.fn();
  const seen: ZoneDraft[] = [];
  function Harness() {
    const [d, setD] = useState(initial);
    const shown = d.slice ? addStroke(d, sliceCells(game, d.level, d.slice.from, d.to, d.slice.percent)) : d;
    const edit = toEdit(shown, game.zones);
    const chip = edit.cells.length ? { ...boundaryChip(game, edit, game.policy), ...chipOverride } : null;
    return (
      <ZoneSheet
        draft={d}
        edit={edit}
        chip={chip}
        targetsFor={(level) => targets(level, new Set())}
        sources={sliceSources(d.level, game.zones, d.to)}
        onChange={(n) => {
          seen.push(n);
          setD(n);
        }}
        onCommit={onCommit}
        onClose={onClose}
      />
    );
  }
  render(<Harness />);
  return { onCommit, onClose, seen };
}

/** Sets a select the way a browser does. */
function choose(name: string, value: string) {
  const select = screen.getByRole('combobox', { name }) as HTMLSelectElement;
  select.value = value;
  act(() => {
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const chip = () => screen.getByTestId('boundary-chip');
const sources = (el: Element) => [...el.querySelectorAll('[data-source]')].map((e) => e.getAttribute('data-source'));

describe('ZoneSheet', () => {
  it('asks for paint until a block changes zone', () => {
    setup();
    expect(screen.getByText('One finger paints. Two pan.')).toBeTruthy();
    expect(screen.queryByTestId('boundary-chip')).toBeNull();
    expect((screen.getByRole('button', { name: 'Add to plan' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Undo stroke' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('picks the level and the target school from menus', () => {
    const { seen } = setup();
    expect((screen.getByRole('combobox', { name: 'Paint into' }) as HTMLSelectElement).value).toBe('rosa-parks');
    choose('Paint into', 'peninsula');
    expect(seen.at(-1)!.to).toBe('peninsula');
    click('6-8');
    expect(seen.at(-1)).toMatchObject({ level: 'middle', strokes: [] });
    expect(screen.getByRole('button', { name: '6-8' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('combobox', { name: 'Paint into' }) as HTMLSelectElement).value).toBe('astor');
  });

  it('shows Seats, Walk, Now and At maturity, every number sourced', () => {
    const d = addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula);
    const c = boundaryChip(game, toEdit(d, game.zones), game.policy);
    setup(d);
    const text = chip().textContent!;
    expect(text).toContain(`Rosa Parks${fmtRange(c.seats[0].after)}/594`);
    expect(text).toContain('Peninsula');
    expect(text).toMatch(/K-5 walkers at maturity[+−]?\d+~/);
    expect(text).toContain(`${peninsula.length} blocks of 250 m, ${c.residents}~ resident kids`);
    expect(sources(chip())).toEqual(
      expect.arrayContaining(['model.schoolRange', 'dial.walkK5', 'model.busing', 'model.zoneGrid', 'model.households', 'model.sliceStay', 'dial.newBusRiders']),
    );
    expect(chip().querySelectorAll('button:not([data-source], .term)')).toHaveLength(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('adds seats at maturity when they differ from next fall', () => {
    const d = addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula);
    const seats = [{ school: 'rosa-parks', before: { lo: 400, hi: 450 }, after: { lo: 400, hi: 450 }, mature: { lo: 430, hi: 480 }, capacity: 594 }];
    setup(d, { seats });
    expect(screen.getByText('Seats at maturity').closest('div')!.textContent).toBe('Seats at maturityRosa Parks430–480~/594');
    cleanup();
    setup(d, { seats: [{ ...seats[0], mature: seats[0].after }] });
    expect(screen.queryByText('Seats at maturity')).toBeNull();
  });

  it('marks zero busing as modeled and sources the net figure to busing', () => {
    const d = addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula);
    setup(d, { now: { lo: 0, hi: 0 }, atMaturity: { lo: -60_000, hi: -20_000 } });
    expect(chip().textContent).toContain('Now$0~');
    const later = screen.getByText('At maturity').closest('dt')!.nextElementSibling!;
    expect(sources(later)).toEqual(['model.busing']);
  });

  it('shows busing as signed ranges', () => {
    const d = addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula);
    setup(d, { now: { lo: -250_000, hi: -140_000 }, atMaturity: { lo: -60_000, hi: -20_000 }, riders: { now: 100, atMaturity: 30 } });
    const text = chip().textContent!;
    expect(text).toContain('Now−$250K to −$140K~');
    expect(text).toContain('At maturity−$60K to −$20K~');
    expect(text).toContain('Riders now/later+100~/+30~');
  });

  it('warns, without blocking, when the blocks do not touch the zone', () => {
    const d = addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula);
    setup(d, { contiguous: false });
    expect(screen.getByRole('alert').textContent).toContain("don't touch");
    expect((screen.getByRole('button', { name: 'Add to plan' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('undoes one stroke at a time and toggles grandfathering', () => {
    const d = addStroke(addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula.slice(0, 2)), peninsula.slice(2));
    const { seen } = setup(d);
    click('Undo stroke');
    expect(seen.at(-1)!.strokes).toEqual([peninsula.slice(0, 2)]);
    const keep = screen.getByRole('checkbox', { name: /Grandfather/ }) as HTMLInputElement;
    expect(keep.checked).toBe(true);
    fireEvent.click(keep);
    expect(seen.at(-1)!.grandfather).toBe(false);
  });

  it('slices the N% of a zone nearest the target, without dragging', () => {
    const { seen, onCommit } = setup();
    click('Slice…');
    expect(seen.at(-1)!.slice).toEqual({ from: 'cesar-chavez', percent: 25 });
    choose('Zone', 'peninsula');
    click('More Share');
    expect(seen.at(-1)!.slice).toEqual({ from: 'peninsula', percent: 30 });
    expect(screen.getByText(/30% of Peninsula/).textContent).toBe('Move the 30% of Peninsula nearest Rosa Parks');
    expect(chip()).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /Grandfather/ }));
    click('Add to plan');
    const committed: BoundaryEdit = onCommit.mock.calls[0][0];
    expect(committed).toEqual({ level: 'elementary', to: 'rosa-parks', cells: peninsula, grandfather: false });
  });

  it('goes back to painting without the slice', () => {
    const { seen } = setup();
    click('Slice…');
    click('Back');
    expect(seen.at(-1)!.slice).toBeUndefined();
    expect(screen.getByText('One finger paints. Two pan.')).toBeTruthy();
  });

  it('counts only blocks that change zone', () => {
    const d = addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula);
    expect(draftCells(d, game.zones)).toEqual(peninsula);
    setup(d);
    expect(chip().textContent).toContain(`${peninsula.length} blocks of 250 m`);
  });
});

describe('ZoneSheet glossary', () => {
  it('defines the zone, grandfathering and each chip cell', () => {
    setup();
    expect(termsIn()).toEqual(['Zone', 'Grandfather']);
    cleanup();
    setup(addStroke(startZoneDraft('elementary', 'rosa-parks'), peninsula));
    expect(termsIn()).toEqual(['Zone', 'Seats', 'Seats', 'K-5 walkers', 'Now', 'At maturity', 'New bus riders', 'Blocks', 'Grandfather']);
  });

  it('defines a slice', () => {
    setup();
    click('Slice…');
    expect(termsIn()[0]).toBe('Slice');
  });
});
