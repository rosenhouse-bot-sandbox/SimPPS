import { describe, expect, it } from 'vitest';
import { HIGH_SCHOOLS, SCHOOLS, ZONES } from '.';

describe('pps-data snapshot', () => {
  it('has the 74 in-scope schools and 9 high schools', () => {
    expect(SCHOOLS).toHaveLength(74);
    expect(HIGH_SCHOOLS).toHaveLength(9);
  });

  it('sums fall 2025 in-scope enrollment to 26,966', () => {
    expect(SCHOOLS.reduce((sum, s) => sum + (s.enrollment ?? 0), 0)).toBe(26_966);
  });

  it('links every zone to a known school', () => {
    const ids = new Set([...SCHOOLS, ...HIGH_SCHOOLS].map((s) => s.id));
    for (const zone of [...ZONES.elementary, ...ZONES.middle, ...ZONES.high]) {
      expect(ids).toContain(zone.school);
    }
  });

  it('has 53 elementary, 23 middle and 10 high zones', () => {
    expect([ZONES.elementary.length, ZONES.middle.length, ZONES.high.length]).toEqual([53, 23, 10]);
  });
});
