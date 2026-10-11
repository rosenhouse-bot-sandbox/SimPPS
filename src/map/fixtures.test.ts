import { describe, expect, it } from 'vitest';
import { SCHOOLS, ZONES } from '../data';
import { fixtureHouseholds, fixtureSchools } from './fixtures';
import { inZone } from '../sim/geo';

describe('fixtures', () => {
  it('builds a school state from fall 2025 enrollment and capacity', () => {
    const schools = fixtureSchools();
    expect(Object.keys(schools)).toHaveLength(SCHOOLS.length);
    const rosa = schools['rosa-parks'];
    expect([rosa.enrollment, rosa.capacity, rosa.open]).toEqual([160, 594, true]);
    expect(rosa.byGrade.reduce((a, b) => a + b, 0)).toBe(160);
  });

  it('places households inside their elementary zone with every status', () => {
    const households = fixtureHouseholds(300, 7);
    expect(households).toHaveLength(300);
    for (const h of households) {
      const zone = ZONES.elementary.find((z) => z.school === h.zoneSchool)!;
      expect(inZone(h.pos, zone)).toBe(true);
      expect(h.school === null).toBe(h.status === 'left');
    }
    expect(new Set(households.map((h) => h.status))).toEqual(new Set(['stayed', 'moved', 'left', 'returned']));
  });

  it('repeats for the same seed', () => {
    expect(fixtureHouseholds(20, 3)).toEqual(fixtureHouseholds(20, 3));
    expect(fixtureHouseholds(20, 3)).not.toEqual(fixtureHouseholds(20, 4));
  });
});
