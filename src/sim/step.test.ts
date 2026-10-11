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
  const { next } = endYear(start, DEFAULT_POLICY);
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

  it('keeps leavers who stay in Portland as residents outside PPS', () => {
    const stayers = continuing.filter((h) => h.status === 'left' && !h.movedAway);
    expect(stayers.length).toBeGreaterThan(100);
    for (const h of stayers) expect(h.school).toBeNull();
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
