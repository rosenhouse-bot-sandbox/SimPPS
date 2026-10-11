import { describe, expect, it } from 'vitest';
import { HIGH_SCHOOLS, type Point } from '../data';
import { RIVERS } from './rivers';

/** The other coordinate where the polyline crosses `value` on `axis` (0 = x, 1 = y). */
function crossing(points: Point[], axis: 0 | 1, value: number): number {
  const other = 1 - axis;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if ((a[axis] - value) * (b[axis] - value) <= 0 && a[axis] !== b[axis]) {
      return a[other] + ((value - a[axis]) / (b[axis] - a[axis])) * (b[other] - a[other]);
    }
  }
  throw new Error(`no crossing at ${value}`);
}

describe('rivers', () => {
  const river = (name: string) => RIVERS.find((r) => r.name === name)!.points;
  const hs = (name: string) => HIGH_SCHOOLS.find((h) => h.name.startsWith(name))!;

  it('runs the Willamette near x=0 between Lincoln and Cleveland', () => {
    const x = crossing(river('Willamette'), 1, hs('Lincoln').y);
    expect(x).toBeGreaterThan(hs('Lincoln').x);
    expect(x).toBeLessThan(hs('Cleveland').x);
    expect(Math.abs(x)).toBeLessThan(1500);
  });

  it('puts Roosevelt east of the Willamette and south of the Columbia', () => {
    const roosevelt = hs('Roosevelt');
    expect(crossing(river('Willamette'), 1, roosevelt.y)).toBeLessThan(roosevelt.x);
    expect(crossing(river('Columbia'), 0, roosevelt.x)).toBeLessThan(roosevelt.y);
  });
});
