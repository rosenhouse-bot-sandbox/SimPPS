import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, endYear, newGame } from '.';
import { kCaptureTrend, worseYear } from './step';

describe('worseYear', () => {
  it('adds exit for class size above 24 and for cuts, capped at one point', () => {
    expect(worseYear(24, 0)).toBe(0);
    expect(worseYear(28, 0)).toBeCloseTo(0.01);
    expect(worseYear(26, 0)).toBeCloseTo(0.005);
    expect(worseYear(24, 400)).toBeGreaterThan(0.003);
    expect(worseYear(28, 1000)).toBe(0.01);
    expect(worseYear(22, 0)).toBeCloseTo(-0.005);
  });
});

describe('kCaptureTrend', () => {
  it('rises from 74% to the 79% PSU assumes by 2028, then holds', () => {
    expect(kCaptureTrend(-1)).toBeCloseTo(0.74);
    expect(kCaptureTrend(0)).toBeGreaterThan(0.75);
    expect(kCaptureTrend(2)).toBeCloseTo(0.79);
    expect(kCaptureTrend(8)).toBeCloseTo(0.79);
  });
});

describe('the moving roll', () => {
  const start = newGame({ seed: 'moves' });
  const { next, report } = endYear(start, DEFAULT_POLICY);
  const before = new Map(start.households.map((h) => [h.id, h]));
  const continuing = next.households.filter((h) => before.get(h.id)?.school);

  it('takes more kids from households with exit capacity', () => {
    const leaveShare = (pred: (x: number) => boolean) => {
      const group = continuing.filter((h) => pred(h.exitCapacity));
      return group.filter((h) => h.status === 'left').length / group.length;
    };
    expect(leaveShare((x) => x > 0.8)).toBeGreaterThan(leaveShare((x) => x < 0.4));
  });

  it('drops households that moved away the year after', () => {
    const away = next.households.filter((h) => h.movedAway).map((h) => h.id);
    expect(away.length).toBeGreaterThan(100);
    const ids = new Set(endYear(next, DEFAULT_POLICY).next.households.map((h) => h.id));
    for (const id of away) expect(ids.has(id)).toBe(false);
  });

  it('marks only this year\'s leavers as having left this year', () => {
    const marked = next.households.filter((h) => h.leftThisYear);
    expect(marked).toHaveLength(report.flows.leftPps);
    for (const h of marked) expect(before.get(h.id)?.school).toBeTruthy();
    expect(start.households.some((h) => h.leftThisYear)).toBe(false);
  });

  it('clears the mark a year later', () => {
    const marked = new Set(next.households.filter((h) => h.leftThisYear).map((h) => h.id));
    const later = endYear(next, DEFAULT_POLICY).next.households;
    expect(later.filter((h) => marked.has(h.id) && h.leftThisYear)).toEqual([]);
  });

  it('keeps leavers who stay in Portland as residents outside PPS', () => {
    const stayers = continuing.filter((h) => h.status === 'left' && !h.movedAway);
    expect(stayers.length).toBeGreaterThan(100);
    for (const h of stayers) expect(h.school).toBeNull();
  });
});

describe('class size', () => {
  it('moves only K-5 families', () => {
    const start = newGame({ seed: 'class' });
    const noCuts = { ...DEFAULT_POLICY, levyRate: 5 };
    const base = endYear(start, noCuts).next.households;
    const big = endYear(start, { ...noCuts, k5ClassSize: 28 }).next.households;
    const left = (hs: typeof base, lo: number, hi: number) =>
      hs.filter((h) => h.status === 'left' && h.kids.slice(lo, hi + 1).includes(1)).length;
    expect(left(big, 1, 5)).toBeGreaterThan(left(base, 1, 5));
    expect(left(big, 6, 8)).toBe(left(base, 6, 8));
  });
});

describe('policy bounds', () => {
  it('keeps K-5 class size within 22-28', () => {
    const start = newGame({ seed: 'bounds' });
    const at40 = endYear(start, { ...DEFAULT_POLICY, k5ClassSize: 40 });
    const at28 = endYear(start, { ...DEFAULT_POLICY, k5ClassSize: 28 });
    expect(at40.next.dials).toEqual(at28.next.dials);
    expect(at40.next.policy.k5ClassSize).toBe(28);
  });
});
