import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_SIM } from '../ui/fixtures';
import { App } from './App';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function hold(name: string) {
  const b = screen.getByRole('button', { name: `${name} (press and hold)` });
  fireEvent.pointerDown(b);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

function gapBar() {
  return screen.getByTestId('gapbar').textContent;
}

function setup() {
  render(<App sim={FIXTURE_SIM} seed="t" playbackMs={5000} />);
}

describe('App', () => {
  it('opens in January 2027 on the map with the top bar dials', () => {
    setup();
    expect(screen.getByTestId('map-slot')).toBeTruthy();
    const top = document.querySelector('.topbar')!.textContent;
    expect(top).toContain('JAN 2027');
    expect(top).toContain('Gap −$65.2M');
    expect(top).toContain('Kids 26.4K');
    expect(top).toContain('Cap 76.6%');
    expect(top).toContain('Res 4.8%');
  });

  it('sources the top bar numbers', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '76.6%' }));
    expect(screen.getByRole('dialog', { name: 'Capture' })).toBeTruthy();
  });

  it('updates the pinned gap and shows a chip when a budget lever moves', () => {
    setup();
    expect(gapBar()).toContain('−$65.2M');
    fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
    fireEvent.click(screen.getByRole('button', { name: 'More K-5 class size' }));
    expect(gapBar()).toContain('−$62.2M to −$60.2M~');
    expect(document.querySelector('.chip')!.textContent).toContain('Now+$3M–$5M~');
    fireEvent.click(screen.getByRole('button', { name: 'Less Levy rate' }));
    fireEvent.click(screen.getByRole('button', { name: 'More Reserve draw' }));
    expect(document.querySelectorAll('.chip')).toHaveLength(3);
  });

  it('shows "lapse" when the levy reaches zero', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
    const less = screen.getByRole('button', { name: 'Less Levy rate' }) as HTMLButtonElement;
    for (let i = 0; i < 25; i++) fireEvent.click(less);
    expect(screen.getByRole('group', { name: 'Levy rate' }).textContent).toContain('lapse');
    expect(less.disabled).toBe(true);
  });

  it('opens a school from the A–Z list', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rosa Parks Elementary School' }));
    expect(screen.getByRole('region', { name: 'Rosa Parks Elementary School' })).toBeTruthy();
  });

  it('plays a full year: hold End, review, hold to play, report, next January', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
    fireEvent.click(screen.getByRole('button', { name: 'More K-5 class size' }));

    hold('End year');
    const pre = screen.getByRole('region', { name: 'Play 2027-28?' });
    expect(pre.textContent).toContain('K-5 class size 24 → 25');
    expect(pre.textContent).toContain('positions in June');

    hold('Play the year');
    expect(screen.getByTestId('playback')).toBeTruthy();
    expect(document.querySelector('.topbar')!.textContent).toContain('APR 2027');
    expect((screen.getByRole('button', { name: 'Budget' }) as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(document.querySelector('.topbar')!.textContent).toContain('DEC 2027');
    expect(screen.getByRole('region', { name: 'The Bulletin' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Plan 2028' }));
    expect(document.querySelector('.topbar')!.textContent).toContain('JAN 2028');

    fireEvent.click(screen.getByRole('button', { name: 'News' }));
    expect(screen.getByRole('region', { name: 'Bulletin 2027' }).textContent).toContain('CUTS REACH EVERY SCHOOL');
  });

  it('lists ballot items and reserves after a draw', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Budget' }));
    fireEvent.click(screen.getByRole('button', { name: 'Less Levy rate' }));
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'More Reserve draw' }));
    expect(screen.getByText(/Reserves after/).textContent).toBe('Reserves after: 4.3%');
    hold('End year');
    const pre = screen.getByRole('region', { name: 'Play 2027-28?' });
    expect(pre.textContent).toContain('May: levy at $1.89 per $1,000');
    expect(pre.textContent).toContain('Draw $4M from reserves');
  });

  it('goes back from the pre-flight sheet without playing', () => {
    setup();
    hold('End year');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('region', { name: 'Play 2027-28?' })).toBeNull();
    expect(screen.queryByTestId('playback')).toBeNull();
  });

  it('picks an overlay and zone level', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Layers' }));
    const seats = screen.getByRole('radio', { name: 'Seats' }) as HTMLInputElement;
    fireEvent.click(seats);
    expect(seats.checked).toBe(true);
    const middle = screen.getByRole('radio', { name: 'Middle' }) as HTMLInputElement;
    fireEvent.click(middle);
    expect(middle.checked).toBe(true);
    const map = screen.getByTestId('map-slot');
    expect(map.dataset.overlay).toBe('seats');
    expect(map.dataset.zoneLevel).toBe('middle');
  });
});
