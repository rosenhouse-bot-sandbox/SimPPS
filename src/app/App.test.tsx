import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCHOOLS, ZONES } from '../data';
import { FALLBACK_SIZE } from '../map/MapView';
import * as realSim from '../sim';
import { getSource } from '../sources/registry';
import { fmtCount, fmtMoney, fmtPct, fmtRange } from '../format';
import { App } from './App';
import type { Sim } from './machine';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function hold(name: string) {
  const b = screen.getByRole('button', { name: `${name} (press and hold)` });
  fireEvent.pointerDown(b);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function gapBar() {
  return screen.getByTestId('gapbar').textContent;
}

function topBar() {
  return document.querySelector('.topbar')!.textContent;
}

function badgeAt(id: string): [number, number] {
  const t = document.querySelector(`[data-school="${id}"]`)!.getAttribute('transform')!;
  const [, x, y] = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(t)!;
  return [Number(x), Number(y)];
}

/** Sheets cover the lower map, so the focus sits at 30% of its height. */
function isFocused([x, y]: [number, number], at = 0.3): boolean {
  return Math.abs(x - FALLBACK_SIZE.w / 2) < 0.5 && Math.abs(y - FALLBACK_SIZE.h * at) < 0.5;
}

function tapBadge(id: string) {
  const [x, y] = badgeAt(id);
  const map = document.querySelector('.pps-map')!;
  fireEvent.pointerDown(map, { pointerId: 1, clientX: x, clientY: y });
  fireEvent.pointerUp(map, { pointerId: 1, clientX: x, clientY: y });
}

function setup(sim: Sim = realSim) {
  render(<App sim={sim} seed="t" playbackMs={5000} />);
}

describe('App', () => {
  it('opens in January 2027 on the map with the top bar dials', () => {
    setup();
    expect(document.querySelectorAll('.pps-map [data-school]').length).toBeGreaterThan(70);
    const top = topBar();
    expect(top).toContain('JAN 2027');
    expect(top).toContain('Gap −$65.2M');
    expect(top).toContain('Kids 26.6K');
    expect(top).toContain('Res 4.8%');
    expect(top).toContain(`Trust ${Math.round(realSim.newGame({ seed: 't' }).dials.trust)}`);
    expect(document.querySelector('.topbar [data-source="dial.trust"]')).toBeTruthy();
  });

  it('saves the plans played so a reload can replay them, and offers a new game', () => {
    const onSave = vi.fn();
    const onNewGame = vi.fn();
    render(<App sim={realSim} seed="t" playbackMs={5000} onSave={onSave} onNewGame={onNewGame} />);
    click('Budget');
    click('More K-5 class size');
    hold('End year');
    hold('Play the year');
    expect(onSave).toHaveBeenLastCalledWith([expect.objectContaining({ k5ClassSize: 25 })]);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    click('Plan 2028');
    click('Plan');
    click('New game');
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  it('opens on the saved plans', () => {
    render(<App sim={realSim} seed="t" playbackMs={5000} saved={[{ ...realSim.DEFAULT_POLICY, k5ClassSize: 25 }]} />);
    expect(topBar()).toContain('JAN 2028');
  });

  it('sources the top bar numbers', () => {
    setup();
    fireEvent.click(document.querySelector('.topbar [data-source="dial.capture"]')!);
    expect(screen.getByRole('dialog', { name: 'Capture' })).toBeTruthy();
  });

  it('pins the gap and cuts June will produce for the draft at flat state funding', () => {
    setup();
    const start = realSim.newGame({ seed: 't' });
    const policy = { ...start.policy, k5ClassSize: 25 };
    const plan = realSim.previewBudget(start, policy);
    const { next, report } = realSim.endYear(start, policy);
    const june = next.dials.positionsCut;
    expect(gapBar()).toContain('−$65.2M');
    click('Budget');
    click('More K-5 class size');
    expect(gapBar()).toContain(fmtMoney(plan.gap));
    expect(gapBar()).toContain(`Cuts ${fmtCount(plan.autoCutPositions)}`);
    expect(document.querySelector('.chip')!.textContent).toContain('Now+$3M–$5M~');

    hold('End year');
    const preflight = screen.getByRole('dialog', { name: 'Play 2027-28?' }).textContent;
    expect(preflight).toContain(`${fmtCount(plan.autoCutPositions)} positions in June`);
    expect(preflight).toContain('At flat state funding. The Legislature votes this spring.');
    hold('Play the year');
    expect(screen.getByTestId('playback').textContent).toContain(`remove ${june.toLocaleString('en-US')} positions`);
    expect(topBar()).toContain(`Gap ${fmtMoney(report.budget.gap)}`);
  });

  it('shows a chip per edited lever', () => {
    setup();
    click('Budget');
    click('More K-5 class size');
    click('Less Levy rate');
    click('More Reserve draw');
    expect(document.querySelectorAll('.chip')).toHaveLength(3);
  });

  it('shows "lapse" when the levy reaches zero', () => {
    setup();
    click('Budget');
    const less = screen.getByRole('button', { name: 'Less Levy rate' }) as HTMLButtonElement;
    for (let i = 0; i < 25; i++) fireEvent.click(less);
    expect(screen.getByRole('group', { name: 'Levy rate' }).textContent).toContain('lapse');
    expect(less.disabled).toBe(true);
  });

  it('opens a school from the A–Z list and brings it into view above the sheet', () => {
    setup();
    click('Plan');
    click('Rosa Parks Elementary School');
    expect(screen.getByRole('region', { name: 'Rosa Parks Elementary School' })).toBeTruthy();
    expect(isFocused(badgeAt('rosa-parks'))).toBe(true);
  });

  it.each(['Plan', 'Budget', 'Layers', 'News'])('opens a school tapped on the map while %s is open', (tool) => {
    setup();
    click(tool);
    tapBadge('rosa-parks');
    const picker = screen.queryByRole('dialog', { name: 'Choose a school' });
    if (picker) fireEvent.click(within(picker).getByRole('button', { name: 'Rosa Parks' }));
    expect(screen.getByRole('region', { name: 'Rosa Parks Elementary School' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: tool })).toBeNull();
  });

  it('plays a full year: hold End, review, hold to play, report, next January', () => {
    setup();
    click('Budget');
    click('More K-5 class size');

    hold('End year');
    const pre = screen.getByRole('dialog', { name: 'Play 2027-28?' });
    expect(pre.textContent).toContain('K-5 class size 24 → 25');

    hold('Play the year');
    expect(screen.getByTestId('playback')).toBeTruthy();
    expect(topBar()).toContain('APR 2027');
    expect((screen.getByRole('button', { name: 'Budget' }) as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(topBar()).toContain('DEC 2027');
    expect(topBar()).toMatch(/2028-29 gap −\$[\d.]+M/);
    expect(screen.getByRole('region', { name: 'The Bulletin' }).querySelectorAll('li')).toHaveLength(3);

    click('Plan 2028');
    expect(topBar()).toContain('JAN 2028');
    expect(topBar()).not.toContain('2028-29 gap');

    click('News');
    expect(screen.getByRole('region', { name: 'Bulletin 2027' }).textContent).toContain('Cuts reach every school');
  });

  it('lists ballot items and what reserves cover', () => {
    setup();
    click('Budget');
    click('Less Levy rate');
    for (let i = 0; i < 4; i++) click('More Reserve draw');
    const start = realSim.newGame({ seed: 't' });
    const plan = realSim.previewBudget(start, { ...start.policy, levyRate: 1.89, reserveDraw: 4e6 });
    expect(screen.getByText(/Reserves after/).closest('.note')!.textContent).toBe(
      `Reserves after: $37.1M, ${fmtPct(plan.reservePctAfterDraw)}`,
    );
    hold('End year');
    const pre = screen.getByRole('dialog', { name: 'Play 2027-28?' });
    const poll = realSim.ballotPreview(start, { ...start.policy, levyRate: 1.89 })!.poll;
    expect(pre.textContent).toContain(`May 2027 levy vote$1.89 per $1K · poll ${Math.round(poll.lo * 100)}–${Math.round(poll.hi * 100)}%~`);
    expect(pre.textContent).toContain('Draw $4M from reserves');
    expect(pre.textContent).toContain('Reserves cover $4M');
  });

  it('warns in pre-flight of the mid-year cuts a deep draw forces', () => {
    setup();
    click('Budget');
    for (let i = 0; i < 42; i++) click('More Reserve draw');
    const start = realSim.newGame({ seed: 't' });
    const plan = realSim.previewBudget(start, { ...start.policy, reserveDraw: start.budget.reserves });
    expect(plan.midYearCuts).toBeGreaterThan(0);
    expect(gapBar()).toContain(`Cuts ${fmtCount(plan.autoCutPositions + plan.midYearCuts)}`);
    hold('End year');
    expect(screen.getByRole('dialog', { name: 'Play 2027-28?' }).textContent).toContain(
      `${fmtCount(plan.midYearCuts)} more mid-year`,
    );
  });

  it('shows the draft gap in the top bar while planning', () => {
    setup();
    const start = realSim.newGame({ seed: 't' });
    const plan = realSim.previewBudget(start, { ...start.policy, k5ClassSize: 25 });
    click('Budget');
    click('More K-5 class size');
    expect(topBar()).toContain(`Gap ${fmtMoney(plan.gap)}`);
  });

  it('can restore the levy to its current rate after stepping past it', () => {
    setup();
    click('Budget');
    click('More Levy rate');
    click('Less Levy rate');
    expect(screen.getByRole('group', { name: 'Levy rate' }).textContent).toContain('$1.99');
    expect(document.querySelectorAll('.chip')).toHaveLength(0);
  });

  it('goes back from the pre-flight sheet without playing', () => {
    setup();
    hold('End year');
    click('Back');
    expect(screen.queryByRole('dialog', { name: 'Play 2027-28?' })).toBeNull();
    expect(screen.queryByTestId('playback')).toBeNull();
  });

  it('picks an overlay and zone level', () => {
    setup();
    click('Layers');
    fireEvent.click(screen.getByRole('radio', { name: 'Seats' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Middle' }));
    const map = document.querySelector('.pps-map')!;
    expect(map.classList.contains('pps-map-overlay-seats')).toBe(true);
    expect(map.querySelectorAll('[data-zone]')).toHaveLength(ZONES.middle.length);
  });

  it('cites a registered source for every number it shows', () => {
    const keys = new Set<string>();
    const collect = () => document.querySelectorAll('[data-source]').forEach((e) => keys.add(e.getAttribute('data-source')!));
    setup();
    collect();
    click('Budget');
    click('More K-5 class size');
    click('Less Levy rate');
    click('More Reserve draw');
    collect();
    click('Plan');
    click('Rosa Parks Elementary School');
    collect();
    hold('End year');
    collect();
    hold('Play the year');
    for (let i = 0; i < 5; i++) {
      collect();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    collect();
    expect(keys.size).toBeGreaterThan(20);
    for (const k of keys) expect(getSource(k), k).toBeDefined();
  });

  describe('Close & send', { timeout: 20_000 }, () => {
    function openPeninsula() {
      click('Plan');
      click('Peninsula Elementary School');
      click('Close & send');
    }

    const marked = (mark: string) => [...document.querySelectorAll(`[data-mark="${mark}"]`)].map((e) => e.getAttribute('data-school'));

    it('highlights candidates on the map and takes a receiver from a map tap', () => {
      setup();
      openPeninsula();
      expect(marked('closing')).toEqual(['peninsula']);
      expect(marked('candidate')).toContain('rosa-parks');
      expect(marked('candidate')).toHaveLength(5);
      expect(isFocused(badgeAt('peninsula'))).toBe(true);
      tapBadge('rosa-parks');
      expect(screen.getByRole('button', { name: /Rosa Parks/ }).getAttribute('aria-pressed')).toBe('true');
      expect(marked('receiver')).toEqual(['rosa-parks']);
      expect(document.querySelector('[data-link="peninsula>rosa-parks"]')).toBeTruthy();
    });

    it('puts the closure in the plan with Undo, in pre-flight and in the report', () => {
      setup();
      openPeninsula();
      click(/Rosa Parks/);
      click('Next >');
      click('Next >');
      click('Close it');
      click('Call it');
      expect(screen.queryByTestId('closure-chip')).toBeNull();
      expect(screen.getByText(/In the plan/).textContent).toBe('In the plan: Close Peninsula → Rosa Parks');
      const start = realSim.newGame({ seed: 't' });
      const closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const };
      expect(gapBar()).toContain(fmtMoney(realSim.previewBudget(start, { ...start.policy, closures: [closure] }).gap));

      click('Plan');
      click('Undo Close Peninsula → Rosa Parks');
      expect(screen.getByText('None yet.')).toBeTruthy();
      click('Peninsula Elementary School');
      click('Close & send');
      click(/Rosa Parks/);
      click('Next >');
      click('Next >');
      click('Close it');
      click('Call it');
      click('Plan');
      click('Sitton Elementary School');
      expect(isFocused(badgeAt('sitton'))).toBe(true);

      hold('End year');
      expect(screen.getByRole('dialog', { name: 'Play 2027-28?' }).textContent).toContain('Close Peninsula → Rosa Parks');
      hold('Play the year');
      expect(document.querySelector('[data-link="peninsula>rosa-parks"]')).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(isFocused(badgeAt('peninsula'), 0.5)).toBe(true);
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      const report = screen.getByRole('region', { name: 'Where Peninsula kids went' });
      expect(report.textContent).toContain('Rosa Parks');
      expect(report.querySelector('.call')!.textContent).toMatch(/^You called \d+\. Stayed in PPS: \d+–\d+~ (HIT|MISS)$/);
    });

    function closeInto(receiver: RegExp) {
      click(receiver);
      click('Next >');
      click('Next >');
      click('Close it');
      click('Skip');
    }

    it('offers no closure of a school that takes kids in the plan', () => {
      setup();
      openPeninsula();
      closeInto(/Rosa Parks/);
      click('Plan');
      click('Rosa Parks Elementary School');
      expect(screen.getByText(/takes kids from Peninsula/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Close & send' })).toBeNull();
    });

    it("counts the plan's other closures into the same receiver on the chip", () => {
      setup();
      openPeninsula();
      closeInto(/Rosa Parks/);
      click('Plan');
      click('Sitton Elementary School');
      click('Close & send');
      click('All schools A–Z');
      click(/Rosa Parks/);
      click('Next >');
      const start = realSim.newGame({ seed: 't' });
      const to = (school: string) => ({ school, receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const });
      const chip = realSim.closureChip(start, to('sitton'), [to('peninsula')], 24);
      const seats = screen.getByTestId('closure-chip').querySelector('dd')!.textContent;
      expect(seats).toBe(`${fmtRange(realSim.modeledRange(chip.seats.kids))}/594`);
    });

    it('boards up the closed school next year and offers no second closure', () => {
      setup();
      openPeninsula();
      click(/Rosa Parks/);
      click('Next >');
      click('Next >');
      click('Close it');
      click('Skip');
      hold('End year');
      hold('Play the year');
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      click('Plan 2028');
      expect(document.querySelector('[data-school="peninsula"]')!.classList.contains('closed')).toBe(true);
      click('Plan');
      expect(screen.getByText('None yet.')).toBeTruthy();
      click('Peninsula Elementary School');
      expect(screen.getByText('Closed in 2027, mothballed.')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Close & send' })).toBeNull();
    });
  });

  it('cites a registered source for every Close & send number', () => {
    const keys = new Set<string>();
    const collect = () => document.querySelectorAll('[data-source]').forEach((e) => keys.add(e.getAttribute('data-source')!));
    setup();
    click('Plan');
    click('Maplewood Elementary School');
    click('Close & send');
    collect();
    click(/Hayhurst/);
    click(/Rieke/);
    click('Next >');
    collect();
    click('Next >');
    fireEvent.click(screen.getByRole('radio', { name: /Sell/ }));
    collect();
    click('Close it');
    collect();
    click('Call it');
    click('Plan');
    collect();
    hold('End year');
    hold('Play the year');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    collect();
    for (const k of ['ui.distance', 'ui.share', 'ui.closureWalk', 'ui.paysOff', 'model.buildingFate', 'ui.callIt', 'model.nonFollowers'])
      expect(keys).toContain(k);
    for (const k of keys) expect(getSource(k), k).toBeDefined();
  });

  it('replaces a closure when the player changes it', () => {
    setup();
    click('Plan');
    click('Peninsula Elementary School');
    click('Close & send');
    click(/Rosa Parks/);
    click('Next >');
    click('Next >');
    click('Close it');
    click('Skip');
    click('Change closure');
    click('Next >');
    click('Next >');
    fireEvent.click(screen.getByRole('radio', { name: /Sell/ }));
    click('Close it');
    click('Skip');
    click('Plan');
    expect([...document.querySelectorAll('.edits li [data-source]')].map((e) => e.textContent)).toEqual([
      'Close Peninsula → Rosa Parks · sold',
    ]);
  });

  it('drops an unfinished Close & send at End year', () => {
    setup();
    click('Plan');
    click('Peninsula Elementary School');
    click('Close & send');
    hold('End year');
    click('Back');
    expect(screen.queryByRole('region', { name: 'Close Peninsula' })).toBeNull();
  });

  it('asks for a start on first load and loads a scenario as ordinary edits', () => {
    const onStart = vi.fn();
    render(<App sim={realSim} seed="t" start={null} onStart={onStart} playbackMs={5000} />);
    fireEvent.click(screen.getByRole('button', { name: 'PPS Scenario A' }));
    expect(onStart).toHaveBeenCalledWith('scenario-a');
    expect(screen.queryByRole('button', { name: 'PPS Scenario B' })).toBeNull();
    click('Plan');
    expect(document.querySelectorAll('.edits li')).toHaveLength(21);
    expect(screen.getByText(realSim.SCENARIOS['scenario-a'].notModeled!)).toBeTruthy();
    expect(document.querySelectorAll('[data-mark="closing"]')).toHaveLength(14);
    expect(document.querySelectorAll('[data-mark="converting"]')).toHaveLength(7);
    click('Rosa Parks Elementary School');
    expect(screen.getByText(/takes kids/).textContent).toBe(
      'In the plan: takes kids from Peninsula. Change that closure to close this school.',
    );
  });

  describe('Send 6–8', { timeout: 30_000 }, () => {
    const marked = (mark: string) => [...document.querySelectorAll(`[data-mark="${mark}"]`)].map((e) => e.getAttribute('data-school'));
    function tapBadge(id: string) {
      const [x, y] = badgeAt(id);
      const map = document.querySelector('.pps-map')!;
      fireEvent.pointerDown(map, { pointerId: 1, clientX: x, clientY: y });
      fireEvent.pointerUp(map, { pointerId: 1, clientX: x, clientY: y });
    }

    it("sends a K-8's grades 6-8 through the plan, pre-flight and report", () => {
      setup();
      click('Plan');
      click('Beverly Cleary School');
      click('Send 6–8 to…');
      expect(marked('converting')).toEqual(['beverly-cleary']);
      expect(marked('candidate')).toContain('beaumont');
      tapBadge('beaumont');
      expect(marked('receiver')).toEqual(['beaumont']);
      expect(document.querySelector('[data-link="beverly-cleary>beaumont"]')).toBeTruthy();
      click('Send 6–8');
      expect(screen.getByText(/In the plan/).textContent).toBe('In the plan: Send Beverly Cleary 6–8 → Beaumont');
      expect(screen.queryByRole('button', { name: 'Close & send' })).toBeNull();
      click('Plan');
      click('Beaumont Middle School');
      expect(screen.getByText(/takes grades/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Close & send' })).toBeNull();

      hold('End year');
      expect(screen.getByRole('dialog', { name: 'Play 2027-28?' }).textContent).toContain('Send Beverly Cleary 6–8 → Beaumont');
      hold('Play the year');
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByRole('region', { name: 'Where Beverly Cleary 6–8 went' }).textContent).toContain('Beaumont');
      click('Plan 2028');
      click('Plan');
      click('Beverly Cleary School');
      expect(screen.getByText(/K-5 since 2027/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Send 6–8 to…' })).toBeNull();
    });
  });

  describe('Zone mode', { timeout: 30_000 }, () => {
    const zoneSheet = () => screen.queryByRole('region', { name: /^Zone:/ });
    function tapAt([x, y]: [number, number]) {
      const map = document.querySelector('.pps-map')!;
      fireEvent.pointerDown(map, { pointerId: 1, clientX: x, clientY: y });
      fireEvent.pointerUp(map, { pointerId: 1, clientX: x, clientY: y });
    }
    function choose(name: string, value: string) {
      const select = screen.getByRole('combobox', { name }) as HTMLSelectElement;
      select.value = value;
      act(() => {
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    function openRosaParks() {
      click('Plan');
      click('Rosa Parks Elementary School');
      click('Edit boundary');
    }

    it('opens from a school sheet on that school, with the block grid', () => {
      setup();
      expect(document.querySelector('[data-testid="zone-grid"]')).toBeNull();
      openRosaParks();
      expect(zoneSheet()!.getAttribute('aria-label')).toBe('Zone: Rosa Parks');
      expect(document.querySelector('[data-testid="zone-grid"]')).not.toBeNull();
      expect(document.querySelector('[data-mark="receiver"]')!.getAttribute('data-school')).toBe('rosa-parks');
      expect(isFocused(badgeAt('rosa-parks'), 0.18)).toBe(true);
      click('Close');
      expect(document.querySelector('[data-testid="zone-grid"]')).toBeNull();
    });

    it('opens from Plan as the menu path', () => {
      setup();
      click('Plan');
      click('Edit boundary');
      expect(zoneSheet()).not.toBeNull();
    });

    it('paints a block with one finger, shows the chip and undoes the stroke', () => {
      setup();
      openRosaParks();
      tapAt(badgeAt('peninsula'));
      const start = realSim.newGame({ seed: 't' });
      const cell = realSim.cellAtPoint([SCHOOLS.find((x) => x.id === 'peninsula')!.x, SCHOOLS.find((x) => x.id === 'peninsula')!.y]);
      const chip = realSim.boundaryChip(start, { level: 'elementary', to: 'rosa-parks', cells: [cell], grandfather: true }, start.policy);
      expect(screen.getByTestId('boundary-chip').textContent).toContain(`${chip.residents}~ resident kids`);
      expect(document.querySelector('[data-painted]')!.getAttribute('d')).not.toBe('');
      click('Undo stroke');
      expect(screen.queryByTestId('boundary-chip')).toBeNull();
      expect(document.querySelector('[data-painted]')!.getAttribute('d')).toBe('');
    });

    it('slices 30% of a zone into the plan, through pre-flight, to the report', () => {
      setup();
      openRosaParks();
      click('Slice…');
      choose('Zone', 'peninsula');
      click('More Share');
      fireEvent.click(screen.getByRole('checkbox', { name: /Grandfather/ }));
      const start = realSim.newGame({ seed: 't' });
      const edit = realSim.sliceEdit(start, 'elementary', 'peninsula', 'rosa-parks', 30, false);
      const chip = realSim.boundaryChip(start, edit, start.policy);
      expect(screen.getByTestId('boundary-chip').textContent).toContain(`${fmtRange(realSim.modeledRange(chip.kidsMoving))} kids must move`);
      click('Add to plan');
      expect(zoneSheet()).toBeNull();
      const line = `Rezone ${edit.cells.length} blocks → Rosa Parks`;
      expect(gapBar()).toContain(fmtMoney(realSim.previewBudget(start, { ...start.policy, boundaryEdits: [edit] }).gap));
      click('Plan');
      expect(screen.getByRole('button', { name: `Undo ${line}` })).toBeTruthy();

      hold('End year');
      expect(screen.getByRole('dialog', { name: 'Play 2027-28?' }).textContent).toContain(line);
      hold('Play the year');
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      const { next, report } = realSim.endYear(start, { ...start.policy, boundaryEdits: [edit] });
      const where = screen.getByRole('region', { name: 'Where re-zoned kids went' });
      expect(where.textContent).toContain(fmtRange(report.rezoned!.zoneSchool));
      expect(screen.getByText(/K-5 walkers/).textContent).toContain(`${next.dials.walkK5.toLocaleString('en-US')}`);
    });

    it('offers no closure of a school that blocks re-zone into in the plan', () => {
      setup();
      openRosaParks();
      click('Slice…');
      choose('Zone', 'peninsula');
      click('Add to plan');
      click('Plan');
      click('Rosa Parks Elementary School');
      expect(screen.getByText(/blocks re-zone into this school/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Close & send' })).toBeNull();
    });

    it('offers no Send 6–8 for a K-8 that 6-8 blocks re-zone into in the plan', () => {
      setup();
      click('Plan');
      click('Beverly Cleary School');
      click('Edit boundary');
      click('6-8');
      expect(zoneSheet()!.getAttribute('aria-label')).toBe('Zone: Beverly Cleary');
      click('Slice…');
      choose('Zone', 'beaumont');
      click('Add to plan');
      click('Plan');
      click('Beverly Cleary School');
      expect(screen.queryByRole('button', { name: 'Send 6–8 to…' })).toBeNull();
    });

    it('drops an unfinished boundary at End year', () => {
      setup();
      openRosaParks();
      tapAt(badgeAt('peninsula'));
      hold('End year');
      expect(screen.getByRole('dialog', { name: 'Play 2027-28?' }).textContent).not.toContain('Rezone');
      click('Back');
      expect(zoneSheet()).toBeNull();
    });
  });
});
