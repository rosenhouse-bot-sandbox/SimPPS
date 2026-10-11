import { describe, expect, it } from 'vitest';
import { ZONES, type Point, type Ring } from '../data';
import { DEFAULT_POLICY, endYear, newGame } from '.';
import { gradeOf } from './model';
import { schoolPos } from './closures';
import { inZone } from './geo';
import { middleZoneSchool } from './population';
import {
  applyEdits,
  CELL_METERS,
  cellAt,
  cellAtPoint,
  closeZones,
  defaultZones,
  homesByCell,
  isContiguous,
  normalizeBoundaryEdits,
  sliceCells,
  zoneGrid,
  zoningYear,
} from './zones';
import type { BoundaryEdit, ClosedSchool } from './types';

const grid = zoneGrid();
const start = newGame({ seed: 'zones' });

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return Math.abs(a / 2);
}

const cellsOf = (level: 'elementary' | 'middle', school: string) =>
  grid.cells.filter((c) => defaultZones()[level][c.id] === school).map((c) => c.id);

describe('the zone grid', () => {
  it('tiles every elementary zone with blocks no bigger than a grid square', () => {
    ZONES.elementary.forEach((zone, z) => {
      const cells = grid.cells.filter((c) => c.elemZone === z);
      const area = cells.reduce((a, c) => a + c.area, 0);
      expect(Math.abs(area - zone.rings.reduce((a, r) => a + ringArea(r), 0)) / area, zone.school).toBeLessThan(0.001);
    });
    for (const c of grid.cells) expect(c.area).toBeLessThanOrEqual(CELL_METERS ** 2 + 1);
    expect(CELL_METERS).toBeGreaterThanOrEqual(200);
    expect(CELL_METERS).toBeLessThanOrEqual(300);
  });

  it('zones each block to its elementary school and the middle school at most of its points', () => {
    expect(new Set(defaultZones().elementary)).toEqual(new Set(ZONES.elementary.map((z) => z.school)));
    expect(new Set(defaultZones().middle)).toEqual(new Set(ZONES.middle.map((z) => z.school)));
    const c = grid.cells.find((x) => x.area === CELL_METERS ** 2 && x.ix * CELL_METERS > 2000)!;
    expect(defaultZones().middle[c.id]).toBe(middleZoneSchool(c.center, ZONES.elementary[c.elemZone].school));
  });

  it("zones every home to its block's middle school, so the map shows each home's zone", () => {
    const off = start.households.filter((h) => gradeOf(h) >= 6 && h.zoneSchool !== defaultZones().middle[h.cell]);
    expect(off).toEqual([]);
    const later = endYear(start, DEFAULT_POLICY).next;
    expect(later.households.filter((h) => gradeOf(h) >= 6 && h.zoneSchool !== defaultZones().middle[h.cell])).toEqual([]);
  });

  it('maps every household to the block holding it', () => {
    for (const h of start.households) {
      const c = grid.cells[h.cell];
      expect(inZone(h.pos, ZONES.elementary[c.elemZone])).toBe(true);
      expect(Math.floor(h.pos[0] / CELL_METERS) === c.ix && Math.floor(h.pos[1] / CELL_METERS) === c.iy).toBe(true);
    }
  });

  it('finds the block under a tap and none off the map', () => {
    const h = start.households[0];
    expect(cellAtPoint(h.pos)).toBe(h.cell);
    expect(cellAtPoint([1e6, 1e6])).toBe(-1);
  });

  it('falls back to the nearest block of the zone for a point on its edge', () => {
    const z = 0;
    const far: Point = [1e6, 1e6];
    const c = cellAt(far, z);
    expect(grid.cells[c].elemZone).toBe(z);
  });

  it('puts each block center inside its zone when the block is a full square', () => {
    for (const c of grid.cells.filter((x) => x.area === CELL_METERS ** 2).slice(0, 200))
      expect(inZone(c.center, ZONES.elementary[c.elemZone])).toBe(true);
  });
});

describe('sliceCells', () => {
  const homes = (cells: number[]) => {
    const set = new Set(cells);
    return start.households.filter((h) => set.has(h.cell)).length;
  };

  it('takes the blocks of zone X nearest school Y until they hold N% of its homes', () => {
    const zone = cellsOf('elementary', 'creston');
    const slice = sliceCells(start, 'elementary', 'creston', 'atkinson', 20);
    const atk = schoolPos('atkinson');
    const d = (c: number) => Math.hypot(grid.cells[c].center[0] - atk[0], grid.cells[c].center[1] - atk[1]);
    const picked = new Set(slice);
    const farthestPicked = Math.max(...slice.map(d));
    const rest = zone.filter((x) => !picked.has(x));
    for (const c of rest) expect(d(c)).toBeGreaterThanOrEqual(farthestPicked);
    const off = (cells: number[]) => Math.abs(homes(cells) / homes(zone) - 0.2);
    const next = rest.reduce((a, b) => (d(b) < d(a) ? b : a));
    expect(off(slice)).toBeLessThanOrEqual(off(slice.slice(0, -1)));
    expect(off(slice)).toBeLessThanOrEqual(off([...slice, next]));
    for (const c of slice) expect(defaultZones().elementary[c]).toBe('creston');
  });

  it('slices middle zones too', () => {
    const slice = sliceCells(start, 'middle', 'hosford', 'sellwood', 10);
    expect(slice.length).toBeGreaterThan(0);
    for (const c of slice) expect(defaultZones().middle[c]).toBe('hosford');
  });

  it('lands as near N% as whole blocks allow, never on no block', () => {
    for (const [from, to, p] of [['lewis', 'llewellyn', 5], ['beverly-cleary', 'boise-eliot', 10], ['dr-martin-luther-king-jr', 'maplewood', 25]] as const) {
      const zone = cellsOf('elementary', from);
      const slice = sliceCells(start, 'elementary', from, to, p);
      expect(slice.length).toBeGreaterThan(0);
      const share = homes(slice) / homes(zone);
      if (slice.length > 1) expect(Math.abs(share - p / 100)).toBeLessThanOrEqual(Math.abs(homes(slice.slice(0, -1)) / homes(zone) - p / 100));
    }
    expect(sliceCells(start, 'elementary', 'creston', 'atkinson', 0.1)).toHaveLength(1);
  });

  it('takes nothing toward a school it does not know', () => {
    expect(sliceCells(start, 'elementary', 'creston', 'nowhere', 50)).toEqual([]);
  });

  it('takes nothing at 0% and the whole zone at 100%', () => {
    expect(sliceCells(start, 'elementary', 'creston', 'atkinson', 0)).toEqual([]);
    expect(new Set(sliceCells(start, 'elementary', 'creston', 'atkinson', 100))).toEqual(new Set(cellsOf('elementary', 'creston')));
  });
});

describe('isContiguous', () => {
  it('accepts blocks that touch the receiving zone and flags ones that do not', () => {
    const near = sliceCells(start, 'elementary', 'creston', 'atkinson', 10);
    expect(isContiguous(defaultZones(), { level: 'elementary', to: 'atkinson', cells: near, grandfather: false })).toBe(true);
    const far = cellsOf('elementary', 'forest-park').slice(0, 3);
    expect(isContiguous(defaultZones(), { level: 'elementary', to: 'atkinson', cells: far, grandfather: false })).toBe(false);
  });

  it('accepts a chain of painted blocks that reaches the zone', () => {
    const chain = sliceCells(start, 'elementary', 'creston', 'atkinson', 60);
    expect(isContiguous(defaultZones(), { level: 'elementary', to: 'atkinson', cells: chain, grandfather: true })).toBe(true);
  });
});

describe('normalizeBoundaryEdits', () => {
  const cell = cellsOf('elementary', 'creston')[0];

  it('keeps valid blocks once per edit, as entered, so undoing a later edit restores an earlier one', () => {
    const edits: BoundaryEdit[] = [
      { level: 'elementary', to: 'atkinson', cells: [cell, cell, cell + 1], grandfather: true },
      { level: 'elementary', to: 'glencoe', cells: [cell], grandfather: false },
    ];
    expect(normalizeBoundaryEdits(edits)).toEqual([
      { level: 'elementary', to: 'atkinson', cells: [cell, cell + 1], grandfather: true },
      { level: 'elementary', to: 'glencoe', cells: [cell], grandfather: false },
    ]);
  });

  it('drops blocks off the grid, schools without a zone at the level and empty edits', () => {
    const bad = [
      { level: 'elementary', to: 'atkinson', cells: [-1, 1.5, grid.cells.length], grandfather: false },
      { level: 'middle', to: 'atkinson', cells: [cell], grandfather: false },
      { level: 'elementary', to: 'hosford', cells: [cell], grandfather: false },
      { level: 'high', to: 'atkinson', cells: [cell], grandfather: false },
    ] as BoundaryEdit[];
    expect(normalizeBoundaryEdits(bad)).toEqual([]);
    expect(normalizeBoundaryEdits([{ level: 'middle', to: 'hosford', cells: [cell], grandfather: 1 as unknown as boolean }])).toEqual([
      { level: 'middle', to: 'hosford', cells: [cell], grandfather: true },
    ]);
  });
});

describe('closeZones', () => {
  const closed = (school: string, ...to: [string, number][]): ClosedSchool => ({
    school,
    receivers: to.map(([s, share]) => ({ school: s, share })),
    building: 'mothball',
    year: 2027,
    saving: 0,
    staffKept: 0,
  });

  it("re-zones a closed school's blocks to its receiver", () => {
    const zones = closeZones(defaultZones(), [closed('peninsula', ['rosa-parks', 1])], new Map());
    for (const c of cellsOf('elementary', 'peninsula')) expect(zones.elementary[c]).toBe('rosa-parks');
    expect(zones.elementary.includes('peninsula')).toBe(false);
    expect(defaultZones().elementary.includes('peninsula')).toBe(true);
  });

  it('splits homes between two receivers by share, nearer blocks to the nearer receiver', () => {
    const homes = homesByCell(start.households);
    const zones = closeZones(defaultZones(), [closed('maplewood', ['hayhurst', 0.7], ['rieke', 0.3])], homes);
    const cells = cellsOf('elementary', 'maplewood');
    const count = (to: string) => cells.filter((c) => zones.elementary[c] === to).reduce((a, c) => a + (homes.get(c) ?? 0), 0);
    expect(count('hayhurst') / (count('hayhurst') + count('rieke'))).toBeCloseTo(0.7, 1);
    const pull = (c: number) => {
      const p = grid.cells[c].center;
      const [h, r] = [schoolPos('hayhurst'), schoolPos('rieke')];
      return Math.hypot(p[0] - h[0], p[1] - h[1]) - Math.hypot(p[0] - r[0], p[1] - r[1]);
    };
    const toH = cells.filter((c) => zones.elementary[c] === 'hayhurst').map(pull);
    const toR = cells.filter((c) => zones.elementary[c] === 'rieke').map(pull);
    expect(Math.max(...toH)).toBeLessThanOrEqual(Math.min(...toR));
  });

  it('splits a middle zone evenly by homes, not by area', () => {
    const homes = homesByCell(start.households);
    const zones = closeZones(defaultZones(), [closed('sellwood', ['hosford', 0.5], ['lane', 0.5])], homes);
    const cells = cellsOf('middle', 'sellwood');
    const count = (to: string) => cells.filter((c) => zones.middle[c] === to).reduce((a, c) => a + (homes.get(c) ?? 0), 0);
    expect(count('hosford') / (count('hosford') + count('lane'))).toBeCloseTo(0.5, 1);
  });

  it("sends a closed middle zone's blocks to the nearest open middle grades when no receiver serves them", () => {
    const k8 = cellsOf('middle', 'vernon');
    expect(k8.length).toBeGreaterThan(0);
    const zones = closeZones(defaultZones(), [closed('vernon', ['boise-eliot', 1])], new Map());
    for (const c of k8) expect(['vernon', 'boise-eliot']).not.toContain(zones.middle[c]);
    for (const c of cellsOf('elementary', 'vernon')) expect(zones.elementary[c]).toBe('boise-eliot');
  });

  it('is idempotent', () => {
    const once = closeZones(defaultZones(), [closed('peninsula', ['rosa-parks', 1])], new Map());
    expect(closeZones(once, [closed('peninsula', ['rosa-parks', 1])], new Map())).toEqual(once);
  });
});

describe('zoningYear', () => {
  const cell = cellsOf('elementary', 'creston')[0];
  const edit = (to: string, grandfather: boolean): BoundaryEdit => ({ level: 'elementary', to, cells: [cell], grandfather });

  it("gives a block its last edit's zone and grandfathering", () => {
    const z = zoningYear(defaultZones(), [], [edit('atkinson', true), edit('glencoe', false)], new Map());
    expect(z.zones.elementary[cell]).toBe('glencoe');
    expect(z.changed.elementary.get(cell)).toBe(false);
  });

  it('ignores an edit into a closed school, leaving the block to the edit before', () => {
    const closed = { school: 'glencoe', receivers: [{ school: 'atkinson', share: 1 }] };
    const z = zoningYear(defaultZones(), [closed], [edit('sunnyside', false), edit('glencoe', true)], new Map());
    expect(z.zones.elementary[cell]).toBe('sunnyside');
  });

  it('keeps a block that its last edit moves back to its zone', () => {
    const z = zoningYear(defaultZones(), [], [edit('atkinson', false), edit('creston', false)], new Map());
    expect(z.zones.elementary[cell]).toBe('creston');
    expect(z.changed.elementary.has(cell)).toBe(false);
  });
});

describe('applyEdits', () => {
  it('moves the blocks to the new zone without touching the old map', () => {
    const cells = sliceCells(start, 'elementary', 'creston', 'atkinson', 30);
    const zones = applyEdits(defaultZones(), [{ level: 'elementary', to: 'atkinson', cells, grandfather: false }]);
    for (const c of cells) expect(zones.elementary[c]).toBe('atkinson');
    for (const c of cells) expect(defaultZones().elementary[c]).toBe('creston');
    expect(zones.middle).toEqual(defaultZones().middle);
  });
});
