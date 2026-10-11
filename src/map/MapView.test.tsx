import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIGH_SCHOOLS, SCHOOLS, ZONES } from '../data';
import type { SchoolId } from '../sim/types';
import { SEAT_BANDS, seatColor } from './colors';
import { fixtureHouseholds, fixtureSchools } from './fixtures';
import { FALLBACK_SIZE, MapView, type MapViewProps } from './MapView';

const schools = fixtureSchools();

function renderMap(over: Partial<MapViewProps> = {}) {
  const props: MapViewProps = {
    schools,
    households: [],
    overlay: 'none',
    selected: null,
    onSelectSchool: () => {},
    zoneLevel: 'elementary',
    ...over,
  };
  const r = render(<MapView {...props} />);
  return { ...r, map: r.container.querySelector('.pps-map') as HTMLElement };
}

function badgePositions(root: ParentNode): Map<SchoolId, [number, number]> {
  const out = new Map<SchoolId, [number, number]>();
  for (const g of root.querySelectorAll('[data-school]')) {
    const [, x, y] = /translate\(([-\d.e]+) ([-\d.e]+)\)/.exec(g.getAttribute('transform')!)!;
    out.set(g.getAttribute('data-school')!, [Number(x), Number(y)]);
  }
  return out;
}

function nearestOther(pos: Map<SchoolId, [number, number]>, id: SchoolId): number {
  const [x, y] = pos.get(id)!;
  return Math.min(...[...pos].filter(([o]) => o !== id).map(([, p]) => Math.hypot(p[0] - x, p[1] - y)));
}

function tap(el: HTMLElement, [x, y]: [number, number]) {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: x, clientY: y });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: x, clientY: y });
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('MapView', () => {
  it.each(['elementary', 'middle', 'high'] as const)('draws every %s zone', (zoneLevel) => {
    const { container } = renderMap({ zoneLevel });
    expect(container.querySelectorAll('[data-zone]')).toHaveLength(ZONES[zoneLevel].length);
  });

  it('draws a badge per school and a fixed marker per high school', () => {
    const { container } = renderMap();
    expect(container.querySelectorAll('[data-school]')).toHaveLength(SCHOOLS.length);
    expect(container.querySelectorAll('[data-hs]')).toHaveLength(HIGH_SCHOOLS.length);
  });

  it('places badges inside the viewport at district zoom', () => {
    const { container } = renderMap();
    for (const [x, y] of badgePositions(container).values()) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(FALLBACK_SIZE.w);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(FALLBACK_SIZE.h);
    }
  });

  it('selects a lone badge on tap', () => {
    const onSelectSchool = vi.fn();
    const { container, map } = renderMap({ onSelectSchool });
    const pos = badgePositions(container);
    const lone = [...pos.keys()].find((id) => nearestOther(pos, id) > 30)!;
    tap(map, pos.get(lone)!);
    expect(onSelectSchool).toHaveBeenCalledWith(lone);
  });

  it('opens a picker when a tap lands near two badges', () => {
    const onSelectSchool = vi.fn();
    const { container, map } = renderMap({ onSelectSchool });
    const pos = badgePositions(container);
    const crowded = [...pos.keys()].find((id) => nearestOther(pos, id) < 10)!;
    tap(map, pos.get(crowded)!);
    expect(onSelectSchool).not.toHaveBeenCalled();
    const picker = screen.getByRole('dialog', { name: 'Choose a school' });
    const choices = picker.querySelectorAll('button:not(.pps-map-picker-close)');
    expect(choices.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(choices[0]);
    expect(onSelectSchool).toHaveBeenCalledWith(crowded);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not select after a drag', () => {
    const onSelectSchool = vi.fn();
    const { container, map } = renderMap({ onSelectSchool });
    const [x, y] = badgePositions(container).get('rosa-parks')!;
    fireEvent.pointerDown(map, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerMove(map, { pointerId: 1, clientX: x + 40, clientY: y });
    fireEvent.pointerUp(map, { pointerId: 1, clientX: x + 40, clientY: y });
    expect(onSelectSchool).not.toHaveBeenCalled();
    expect(badgePositions(container).get('rosa-parks')![0]).toBeCloseTo(x + 40);
  });

  it('shows short names only after zooming in, and zooms back out', () => {
    const { container } = renderMap();
    const labels = () => container.querySelectorAll('[data-school] text').length;
    expect(labels()).toBe(0);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(labels()).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect((screen.getByLabelText('Zoom in') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(labels()).toBe(0);
  });

  it('snaps a pinch to the nearest zoom level', () => {
    const { container, map } = renderMap();
    const scale = () => Number(/matrix\(([\d.e-]+)/.exec(container.querySelector('svg g')!.getAttribute('transform')!)![1]);
    const before = scale();
    fireEvent.pointerDown(map, { pointerId: 1, clientX: 100, clientY: 300 });
    fireEvent.pointerDown(map, { pointerId: 2, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(map, { pointerId: 2, clientX: 350, clientY: 300 });
    expect(scale() / before).toBeCloseTo(2.5);
    fireEvent.pointerUp(map, { pointerId: 2, clientX: 350, clientY: 300 });
    fireEvent.pointerUp(map, { pointerId: 1, clientX: 100, clientY: 300 });
    expect(scale() / before).toBeCloseTo(3);
  });

  it('steps zoom levels with the mouse wheel', () => {
    const { container, map } = renderMap();
    fireEvent.wheel(map, { deltaY: -100, clientX: 180, clientY: 320 });
    expect(container.querySelectorAll('[data-school] text').length).toBeGreaterThan(0);
  });

  it('colors badges by utilization with a legend in the Seats overlay', () => {
    const { container } = renderMap({ overlay: 'seats' });
    const fill = container.querySelector('[data-school="rosa-parks"] rect')!.getAttribute('fill');
    expect(fill).toBe(seatColor(160 / 594));
    expect(fill).toBe(SEAT_BANDS[0].color);
    for (const b of SEAT_BANDS) expect(screen.getByText(b.label)).toBeTruthy();
  });

  it('rings the selected badge and highlights its zone', () => {
    const { container } = renderMap({ selected: 'rosa-parks' });
    expect(container.querySelectorAll('.pps-map-badge-ring')).toHaveLength(1);
    expect(container.querySelector('[data-school="rosa-parks"] .pps-map-badge-ring')).not.toBeNull();
    expect(container.querySelector('.pps-map-zone-selected')).not.toBeNull();
  });

  it('centers on the focus school', () => {
    const { container } = renderMap({ focus: 'rosa-parks' });
    const [x, y] = badgePositions(container).get('rosa-parks')!;
    expect(x).toBeCloseTo(FALLBACK_SIZE.w / 2);
    expect(y).toBeCloseTo(FALLBACK_SIZE.h / 2);
    expect(container.querySelectorAll('[data-school] text').length).toBeGreaterThan(0);
  });

  it('fills a measured container and centers the focus school in it', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
    const { container } = renderMap({ focus: 'rosa-parks' });
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('500');
    const [x, y] = badgePositions(container).get('rosa-parks')!;
    expect(x).toBeCloseTo(250);
    expect(y).toBeCloseTo(150);
  });

  it('draws household windows on the canvas when it exists', () => {
    const fillRect = vi.fn();
    const ctx = { setTransform() {}, clearRect() {}, fillRect, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    renderMap({ households: fixtureHouseholds(200), overlay: 'families' });
    expect(fillRect).toHaveBeenCalled();
  });

  it('flickers returned households on a timer', () => {
    vi.useFakeTimers();
    try {
      const clearRect = vi.fn();
      const ctx = { setTransform() {}, clearRect, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
      renderMap({ households: fixtureHouseholds(200), overlay: 'families' });
      const before = clearRect.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(clearRect.mock.calls.length).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
