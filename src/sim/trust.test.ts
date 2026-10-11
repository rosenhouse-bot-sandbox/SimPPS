import { describe, expect, it } from 'vitest';
import { M } from './model';
import { REGIONS } from './regions';
import { meanTrust, startTrust, trustAfterYear } from './trust';
import type { Household } from './types';

const at = (region: string, h: Partial<Household> = {}) => ({ pos: [0, 0], region, ...h }) as unknown as Household & { region: string };
const regionOf = (h: Household) => (h as Household & { region?: string }).region ?? null;
const flat = (n: number) => Object.fromEntries(REGIONS.map((r) => [r, n]));

describe('startTrust', () => {
  it('starts each region at 30-40, the same for a seed', () => {
    const t = startTrust(7);
    expect(Object.keys(t).sort()).toEqual(REGIONS);
    for (const v of Object.values(t)) {
      expect(v).toBeGreaterThanOrEqual(M.trustStart.lo);
      expect(v).toBeLessThanOrEqual(M.trustStart.hi);
    }
    expect(startTrust(7)).toEqual(t);
    expect(new Set(Object.values(t)).size).toBeGreaterThan(1);
  });
});

describe('trustAfterYear', () => {
  const [a, b, c] = REGIONS;

  it('adds 2 in a calm year', () => {
    expect(trustAfterYear(flat(35), [at(a)], [], regionOf)).toEqual(flat(37));
  });

  it("takes 8 for a closure, split by where its kids live, with no calm bonus there", () => {
    const moved = [at(a, { movedFrom: 'x' }), at(a, { movedFrom: 'x' }), at(a, { movedFrom: 'x' }), at(b, { movedFrom: 'x' })];
    const t = trustAfterYear(flat(35), moved, ['x'], regionOf);
    expect(t[a]).toBe(35 - 6);
    expect(t[b]).toBe(35 - 2);
    expect(t[c]).toBe(37);
  });

  it('takes 5 where a kid moved a second time, once a year', () => {
    const twice = [at(a, { movedFrom: 'y', forcedMoves: 2 }), at(a, { movedFrom: 'y', forcedMoves: 3 })];
    expect(trustAfterYear(flat(35), twice, [], regionOf)[a]).toBe(30);
  });

  it('counts a boundary move as no closure and no calm year', () => {
    expect(trustAfterYear(flat(35), [at(a, { movedFrom: 'y', forcedMoves: 1 })], [], regionOf)[a]).toBe(35);
  });

  it('stays within 0-100', () => {
    expect(trustAfterYear(flat(99), [], [], regionOf)[a]).toBe(100);
    expect(trustAfterYear(flat(3), [at(a, { movedFrom: 'x', forcedMoves: 2 })], ['x'], regionOf)[a]).toBe(0);
  });
});

describe('meanTrust', () => {
  it('weights regions by the households living there, ignoring those who moved away', () => {
    const [a, b] = REGIONS;
    const t = { ...flat(0), [a]: 30, [b]: 60 };
    const hs = [at(a), at(a), at(b), at(b, { movedAway: true })];
    expect(meanTrust(t, hs, regionOf)).toBe(40);
  });
});
