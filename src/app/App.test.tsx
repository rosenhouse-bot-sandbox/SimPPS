import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZONES } from '../data';
import { FALLBACK_SIZE } from '../map/MapView';
import * as realSim from '../sim';
import { getSource } from '../sources/registry';
import { fmtCount, fmtMoney } from '../ui/format';
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

function click(name: string) {
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

function isCentered([x, y]: [number, number]): boolean {
  return Math.abs(x - FALLBACK_SIZE.w / 2) < 0.5 && Math.abs(y - FALLBACK_SIZE.h / 2) < 0.5;
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
    expect(top).toContain('Kids 27K');
    expect(top).toContain('Res 4.8%');
  });

  it('sources the top bar numbers', () => {
    setup();
    fireEvent.click(document.querySelector('.topbar [data-source="dial.capture"]')!);
    expect(screen.getByRole('dialog', { name: 'Capture' })).toBeTruthy();
  });

  it('pins the gap and cuts June will produce for the draft', () => {
    setup();
    const start = realSim.newGame({ seed: 't' });
    const plan = realSim.previewBudget(start, { ...start.policy, k5ClassSize: 25 });
    expect(gapBar()).toContain('−$65.2M');
    click('Budget');
    click('More K-5 class size');
    expect(gapBar()).toContain(fmtMoney(plan.gap));
    expect(gapBar()).toContain(`Cuts ${fmtCount(plan.autoCutPositions)}`);
    expect(document.querySelector('.chip')!.textContent).toContain('Now+$3M–$5M~');

    hold('End year');
    expect(screen.getByRole('region', { name: 'Play 2027-28?' }).textContent).toContain(
      `${fmtCount(plan.autoCutPositions)} positions in June`,
    );
    hold('Play the year');
    expect(screen.getByTestId('playback').textContent).toContain(
      `remove ${plan.autoCutPositions.toLocaleString('en-US')} positions`,
    );
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

  it('opens a school from the A–Z list and centers the map on it', () => {
    setup();
    click('Plan');
    click('Rosa Parks Elementary School');
    expect(screen.getByRole('region', { name: 'Rosa Parks Elementary School' })).toBeTruthy();
    expect(isCentered(badgeAt('rosa-parks'))).toBe(true);
  });

  it('jumps the camera to a season event at a school', () => {
    const sim: Sim = {
      ...realSim,
      endYear: (state, policy) => {
        const r = realSim.endYear(state, policy);
        const events = r.report.events.map((e) => (e.season === 'summer' ? { ...e, school: 'rosa-parks' } : e));
        return { ...r, report: { ...r.report, events } };
      },
    };
    setup(sim);
    hold('End year');
    hold('Play the year');
    expect(isCentered(badgeAt('rosa-parks'))).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(isCentered(badgeAt('rosa-parks'))).toBe(true);
  });

  it('plays a full year: hold End, review, hold to play, report, next January', () => {
    setup();
    click('Budget');
    click('More K-5 class size');

    hold('End year');
    const pre = screen.getByRole('region', { name: 'Play 2027-28?' });
    expect(pre.textContent).toContain('K-5 class size 24 → 25');

    hold('Play the year');
    expect(screen.getByTestId('playback')).toBeTruthy();
    expect(topBar()).toContain('APR 2027');
    expect((screen.getByRole('button', { name: 'Budget' }) as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(topBar()).toContain('DEC 2027');
    expect(screen.getByRole('region', { name: 'The Bulletin' }).querySelectorAll('li')).toHaveLength(3);

    click('Plan 2028');
    expect(topBar()).toContain('JAN 2028');

    click('News');
    expect(screen.getByRole('region', { name: 'Bulletin 2027' }).textContent).toContain('Cuts reach every school');
  });

  it('lists ballot items and what reserves cover', () => {
    setup();
    click('Budget');
    click('Less Levy rate');
    for (let i = 0; i < 4; i++) click('More Reserve draw');
    expect(screen.getByText(/Reserves after/).textContent).toBe('Reserves after: 4.3%');
    hold('End year');
    const pre = screen.getByRole('region', { name: 'Play 2027-28?' });
    expect(pre.textContent).toContain('May: levy at $1.89 per $1,000');
    expect(pre.textContent).toContain('Draw $4M from reserves');
    expect(pre.textContent).toContain('Reserves cover $4M');
  });

  it('goes back from the pre-flight sheet without playing', () => {
    setup();
    hold('End year');
    click('Back');
    expect(screen.queryByRole('region', { name: 'Play 2027-28?' })).toBeNull();
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
});
