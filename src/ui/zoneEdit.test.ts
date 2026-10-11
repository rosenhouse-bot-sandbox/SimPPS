import { describe, expect, it } from 'vitest';
import { defaultZones } from '../sim';
import type { ZoneMap } from '../sim/types';
import { addStroke, draftCells, sliceSources, startZoneDraft, targets, toEdit, undoStroke } from './zoneEdit';

const zones = defaultZones();
const cellOf = (school: string, n = 0) => zones.elementary.indexOf(school) + n;

describe('zone drafts', () => {
  it('keeps each stroke, so undo takes back only the last', () => {
    const a = [cellOf('peninsula'), cellOf('peninsula', 1)];
    const b = [cellOf('peninsula', 2)];
    const d = addStroke(addStroke(startZoneDraft('elementary', 'rosa-parks'), a), b);
    expect(draftCells(d, zones)).toEqual([...a, ...b]);
    expect(draftCells(undoStroke(d), zones)).toEqual(a);
    expect(addStroke(d, [])).toBe(d);
  });

  it("drops repeats and cells already in the target's zone", () => {
    const own = cellOf('rosa-parks');
    const other = cellOf('peninsula');
    const d = addStroke(startZoneDraft('elementary', 'rosa-parks'), [own, other, other]);
    expect(draftCells(d, zones)).toEqual([other]);
    expect(toEdit({ ...d, grandfather: false }, zones)).toEqual({
      level: 'elementary',
      to: 'rosa-parks',
      cells: [other],
      grandfather: false,
    });
  });

  it('grandfathers by default', () => {
    expect(startZoneDraft('middle', 'gray').grandfather).toBe(true);
  });
});

describe('targets', () => {
  it('lists open schools zoned at the level, A–Z', () => {
    const list = targets('middle', new Set(['gray']));
    expect(list.map((t) => t.id)).not.toContain('gray');
    expect(list.map((t) => t.id)).toContain('harrison-park');
    expect(list.map((t) => t.id)).not.toContain('rosa-parks');
    expect(list.map((t) => t.name)).toEqual([...list.map((t) => t.name)].sort((a, b) => a.localeCompare(b)));
  });
});

describe('sliceSources', () => {
  it('lists zones that hold cells at the level, nearest the target first', () => {
    const list = sliceSources('elementary', zones, 'rosa-parks');
    expect(list.slice(0, 2)).toEqual(['cesar-chavez', 'peninsula']);
    expect(list).not.toContain('rosa-parks');
    const without: ZoneMap = { ...zones, elementary: zones.elementary.map((s) => (s === 'peninsula' ? 'rosa-parks' : s)) };
    expect(sliceSources('elementary', without, 'rosa-parks')).not.toContain('peninsula');
  });
});
