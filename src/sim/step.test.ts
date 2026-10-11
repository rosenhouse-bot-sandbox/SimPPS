import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, endYear, newGame } from '.';
import { M } from './model';
import { kCaptureTrend, leaveChance, worseYear } from './step';
import type { Household } from './types';
import { normalizePolicy } from '.';

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
  it('rises from 74% in fall 2025 to the 79% PSU assumes by fall 2028, then holds', () => {
    expect(kCaptureTrend(2025)).toBeCloseTo(0.74);
    expect(kCaptureTrend(2026)).toBeGreaterThan(0.75);
    expect(kCaptureTrend(2027)).toBeLessThan(0.79);
    expect(kCaptureTrend(2028)).toBeCloseTo(0.79);
    expect(kCaptureTrend(2035)).toBeCloseTo(0.79);
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

describe('leaveChance', () => {
  const h = { exitCapacity: 0.5, loyalty: 0.5 } as Household;

  it('rises with exit capacity', () => {
    expect(leaveChance({ ...h, exitCapacity: 0.9 }, false, 0)).toBeGreaterThan(leaveChance(h, false, 0));
  });

  it('uses the grade 6 exit at a school change', () => {
    expect(leaveChance(h, true, 0)).toBe(M.grade6Exit);
  });

  it('lets loyal households shrug off more of a worse year', () => {
    const loyal = leaveChance({ ...h, loyalty: 1 }, false, 0.01) - leaveChance({ ...h, loyalty: 1 }, false, 0);
    const fickle = leaveChance({ ...h, loyalty: 0 }, false, 0.01) - leaveChance({ ...h, loyalty: 0 }, false, 0);
    expect(loyal).toBeCloseTo(0.0075, 6);
    expect(fickle).toBeCloseTo(0.0125, 6);
  });
});

describe('a worse year', () => {
  const start = newGame({ seed: 'worse' });
  const noCuts = { ...DEFAULT_POLICY, levyRate: 5 };
  const leftInGrades = (hs: Household[], lo: number, hi: number) =>
    hs.filter((h) => h.leftThisYear && h.kids.slice(lo, hi + 1).includes(1)).length;

  it('sends more middle graders away when positions are cut', () => {
    const cut = endYear(start, DEFAULT_POLICY).next.households;
    const uncut = endYear(start, noCuts).next.households;
    expect(leftInGrades(cut, 7, 8)).toBeGreaterThan(leftInGrades(uncut, 7, 8));
  });

  it('draws fewer kindergartners at class size 28', () => {
    const at24 = endYear(start, noCuts).next.dials.kindergartenCapture;
    const at28 = endYear(start, { ...noCuts, k5ClassSize: 28 }).next.dials.kindergartenCapture;
    expect(at28).toBeLessThan(at24);
  });
});

describe('policy bounds', () => {
  it('treats a negative reserve draw as none', () => {
    expect(normalizePolicy({ ...DEFAULT_POLICY, reserveDraw: -5e6 }).reserveDraw).toBe(0);
  });

  it('keeps K-5 class size within 22-28', () => {
    const start = newGame({ seed: 'bounds' });
    const at40 = endYear(start, { ...DEFAULT_POLICY, k5ClassSize: 40 });
    const at28 = endYear(start, { ...DEFAULT_POLICY, k5ClassSize: 28 });
    expect(at40.next.dials).toEqual(at28.next.dials);
    expect(at40.next.policy.k5ClassSize).toBe(28);
  });
});
