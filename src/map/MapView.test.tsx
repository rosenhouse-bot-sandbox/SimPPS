import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HIGH_SCHOOLS, SCHOOLS, ZONES } from '../data';
import type { SchoolId } from '../sim/types';
import { SEAT_BANDS, seatColor } from './colors';
import { fixtureHouseholds, fixtureSchools } from './fixtures';
import { defaultZones, zoneGrid } from '../sim';
import { FALLBACK_SIZE, MAP_BOUNDS, MapView, type MapViewProps, type ZoneEditProps } from './MapView';
import { fitView, toScreen } from './projection';

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

  it('keeps the whole district in view when dragged at district zoom', () => {
    const { container, map } = renderMap();
    const [x, y] = badgePositions(container).get('rosa-parks')!;
    fireEvent.pointerDown(map, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerMove(map, { pointerId: 1, clientX: x + 200, clientY: y + 200 });
    fireEvent.pointerUp(map, { pointerId: 1, clientX: x + 200, clientY: y + 200 });
    expect(badgePositions(container).get('rosa-parks')).toEqual([x, y]);
  });

  it('does not select after a drag', () => {
    const onSelectSchool = vi.fn();
    const { container, map } = renderMap({ onSelectSchool });
    fireEvent.click(screen.getByLabelText('Zoom in'));
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

  it('can place the focus school higher, above a sheet', () => {
    const { container } = renderMap({ focus: 'rosa-parks', focusAt: 0.25 });
    const [x, y] = badgePositions(container).get('rosa-parks')!;
    expect(x).toBeCloseTo(FALLBACK_SIZE.w / 2);
    expect(y).toBeCloseTo(FALLBACK_SIZE.h / 4);
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

describe('MapView for Close & send', () => {
  it('boards up and dims a closed school', () => {
    const closed = { ...schools, peninsula: { ...schools.peninsula, open: false, enrollment: 0 } };
    const { container } = renderMap({ schools: closed });
    const badge = container.querySelector('[data-school="peninsula"]')!;
    expect(badge.classList.contains('closed')).toBe(true);
    expect(badge.querySelector('.pps-map-boards')).toBeTruthy();
    expect(badge.querySelector('title')!.textContent).toBe('Peninsula Elementary School (closed)');
    expect(container.querySelector('[data-school="rosa-parks"] .pps-map-boards')).toBeNull();
  });

  it('marks the closing school, receivers and candidates, and links them', () => {
    const { container } = renderMap({
      marks: { peninsula: 'closing', 'rosa-parks': 'receiver', sitton: 'candidate' },
      links: [['peninsula', 'rosa-parks']],
    });
    for (const [id, mark] of [['peninsula', 'closing'], ['rosa-parks', 'receiver'], ['sitton', 'candidate']])
      expect(container.querySelector(`[data-school="${id}"] .pps-map-mark-${mark}`), id).toBeTruthy();
    expect(container.querySelectorAll('.pps-map-mark')).toHaveLength(3);
    const link = container.querySelector('[data-link="peninsula>rosa-parks"]')!;
    const [px, py] = badgePositions(container).get('peninsula')!;
    expect([Number(link.getAttribute('x1')), Number(link.getAttribute('y1'))]).toEqual([px, py]);
  });

  it('draws closure trails at district zoom when flows are on', () => {
    const fill = vi.fn();
    const line = vi.fn();
    const ctx = { setTransform() {}, clearRect() {}, fillRect: fill, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo: line, stroke() {} };
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const mover = { ...fixtureHouseholds(1)[0], school: 'rosa-parks', status: 'moved' as const, movedFrom: 'peninsula' };
    renderMap({ households: [mover] });
    expect(line).not.toHaveBeenCalled();
    cleanup();
    vi.stubGlobal('requestAnimationFrame', undefined);
    renderMap({ households: [mover], flows: true });
    vi.unstubAllGlobals();
    expect(line).toHaveBeenCalled();
  });
});

describe('MapView in Zone mode', () => {
  const zones = defaultZones();
  const view = fitView(MAP_BOUNDS, FALLBACK_SIZE.w, FALLBACK_SIZE.h);
  const at = (cell: number) => toScreen(view, zoneGrid().cells[cell].center);
  const peninsula = zones.elementary.indexOf('peninsula');

  function zoneMap(over: Partial<ZoneEditProps> = {}) {
    const onStroke = vi.fn();
    const r = renderMap({ zoneEdit: { level: 'elementary', zones: zones.elementary, target: 'rosa-parks', painted: [], onStroke, ...over } });
    return { ...r, onStroke };
  }
  const d = (container: Element, sel: string) => container.querySelector(sel)?.getAttribute('d') ?? '';

  it('shows the block grid only in Zone mode', () => {
    expect(renderMap().container.querySelector('[data-testid="zone-grid"]')).toBeNull();
    cleanup();
    const { container } = zoneMap();
    expect(container.querySelector('[data-testid="zone-grid"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-zone]')).toHaveLength(0);
  });

  it('paints the block under one finger, even on a tap', () => {
    const { map, onStroke } = zoneMap();
    tap(map, at(peninsula));
    expect(onStroke).toHaveBeenCalledWith([peninsula]);
  });

  it('paints every block along a drag, live, and hands the stroke over on lift', () => {
    const { map, container, onStroke } = zoneMap();
    const [x, y] = at(peninsula);
    fireEvent.pointerDown(map, { pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerMove(map, { pointerId: 1, clientX: x + 30, clientY: y });
    const live = d(container, '[data-painted]');
    expect(live).not.toBe('');
    expect(onStroke).not.toHaveBeenCalled();
    fireEvent.pointerUp(map, { pointerId: 1, clientX: x + 30, clientY: y });
    const cells: number[] = onStroke.mock.calls[0][0];
    expect(cells[0]).toBe(peninsula);
    expect(cells.length).toBeGreaterThan(2);
    expect(d(container, '[data-painted]')).toBe('');
  });

  it('pans with two fingers without painting', () => {
    const { map, container, onStroke } = zoneMap();
    const before = badgePositions(container).get('rosa-parks')!;
    fireEvent.click(screen.getByLabelText('Zoom in'));
    const zoomed = badgePositions(container).get('rosa-parks')!;
    fireEvent.pointerDown(map, { pointerId: 1, clientX: 100, clientY: 300 });
    fireEvent.pointerDown(map, { pointerId: 2, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(map, { pointerId: 1, clientX: 140, clientY: 300 });
    fireEvent.pointerMove(map, { pointerId: 2, clientX: 240, clientY: 300 });
    fireEvent.pointerUp(map, { pointerId: 2, clientX: 240, clientY: 300 });
    fireEvent.pointerUp(map, { pointerId: 1, clientX: 140, clientY: 300 });
    expect(onStroke).not.toHaveBeenCalled();
    expect(badgePositions(container).get('rosa-parks')![0]).toBeCloseTo(zoomed[0] + 40);
    expect(before).not.toEqual(zoomed);
    const [x, y] = badgePositions(container).get('peninsula')!;
    tap(map, [x, y]);
    expect(onStroke).toHaveBeenCalledTimes(1);
    expect(onStroke.mock.calls[0][0]).toHaveLength(1);
  });

  it("highlights painted blocks and moves the target zone's outline to take them in", () => {
    const { container } = zoneMap();
    const outline = d(container, '[data-outline="rosa-parks"]');
    expect(outline).not.toBe('');
    expect(d(container, '[data-painted]')).toBe('');
    cleanup();
    const painted = zoneMap({ painted: [peninsula] }).container;
    expect(d(painted, '[data-painted]')).not.toBe('');
    expect(d(painted, '[data-outline="rosa-parks"]')).not.toBe(outline);
  });

  it('draws middle zones at the middle level', () => {
    const { container } = zoneMap({ level: 'middle', zones: zones.middle, target: 'gray' });
    expect(container.querySelector('[data-zone-fill="gray"]')).not.toBeNull();
    expect(container.querySelector('[data-zone-fill="rosa-parks"]')).toBeNull();
  });
});
