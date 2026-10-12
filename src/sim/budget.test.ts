import { describe, expect, it } from 'vitest';
import {
  classesFor,
  computeBudget,
  levyRevenue,
  otherStaff,
  revenuePerStudent,
  statePerStudent,
  stateFundingGrowth,
  stateFundingLevel,
} from './budget';
import { M, setModelParams } from './model';
import type { SchoolState } from './types';

describe('classesFor', () => {
  it('fills full classes', () => {
    expect(classesFor([48, 48, 48, 48, 48, 48, 0, 0, 0], 24)).toEqual({ homerooms: 12, blended: 0 });
  });

  it('staffs K-5 by the school total, filling rooms up to 2 over target', () => {
    expect(classesFor([26, 26, 26, 26, 26, 26, 0, 0, 0], 24)).toEqual({ homerooms: 6, blended: 0 });
    expect(classesFor([50, 0, 0, 0, 0, 0, 0, 0, 0], 24)).toEqual({ homerooms: 2, blended: 0 });
  });

  it('blends grades that do not fill their own rooms', () => {
    expect(classesFor([10, 10, 10, 10, 10, 10, 0, 0, 0], 24)).toEqual({ homerooms: 3, blended: 3 });
    expect(classesFor([30, 30, 30, 30, 30, 30, 0, 0, 0], 24)).toEqual({ homerooms: 7, blended: 5 });
  });

  it('never blends middle grades, which use classes of 26', () => {
    expect(classesFor([0, 0, 0, 0, 0, 0, 10, 10, 53], 24)).toEqual({ homerooms: 5, blended: 0 });
  });

  it('needs fewer homerooms at a larger class size', () => {
    const grades = [61, 70, 66, 75, 58, 69, 0, 0, 0];
    expect(classesFor(grades, 26).homerooms).toBeLessThan(classesFor(grades, 22).homerooms);
  });
});

describe('otherStaff', () => {
  it('steps 6, 7, 8 and 10 positions by size', () => {
    expect([100, 300, 450, 600, 900].map(otherStaff)).toEqual([6, 7, 8, 10, 10]);
  });
});

describe('revenuePerStudent', () => {
  it('runs from $7K to $13K by poverty weight', () => {
    expect(revenuePerStudent(0)).toBe(7_000);
    expect(revenuePerStudent(0.63)).toBe(13_000);
    expect(revenuePerStudent(0.9)).toBe(13_000);
  });
});

describe('levyRevenue', () => {
  it('nets $103.9M at $1.99 and nothing when it lapses', () => {
    expect(levyRevenue(1.99)).toBeCloseTo(103_900_000, -3);
    expect(levyRevenue(0)).toBe(0);
  });

  it('nets less than face value as the rate rises', () => {
    const gain = levyRevenue(2.99) - levyRevenue(1.99);
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThan(103_900_000 / 1.99);
  });
});

describe('computeBudget', () => {
  const rosaParks: SchoolState = {
    id: 'rosa-parks',
    open: true,
    enrollment: 144,
    byGrade: [24, 24, 24, 24, 24, 24, 0, 0, 0],
    capacity: 594,
    stateRevenue: 144 * revenuePerStudent(0.6294),
    homerooms: 6,
    k5Homerooms: 0,
    blendedHomerooms: 0,
  };
  const base = {
    year: 2028,
    schools: { 'rosa-parks': rosaParks },
    policy: { k5ClassSize: 24, reserveDraw: 5_000_000, closures: [] },
    levyRate: 0,
    reserves: 20_000_000,
    priorSpending: 800_000_000,
    cumulativeCuts: 0,
    homeroomsCut: 0,
    restRevenue: 0,
    restCost: 0,
    stateFunding: 1,
    closed: [],
  };
  const amount = (b: ReturnType<typeof computeBudget>, key: string) => b.lines.find((l) => l.key === key)?.amount;

  it('prices one school from its cohorts, staff step and square feet, grown 3.5% a year', () => {
    const b = computeBudget(base);
    expect(amount(b, 'homerooms')).toBeCloseTo(-6 * 159_600 * 1.035, 0);
    expect(amount(b, 'staff')).toBeCloseTo(-6 * 155_000 * 1.035, 0);
    expect(amount(b, 'plant')).toBeCloseTo(-46_657 * 13.8 * 1.035, 0);
    expect(amount(b, 'stateK8')).toBeCloseTo(144 * revenuePerStudent(0.6294), 0);
  });

  it('carries earlier cuts as savings and keeps closed schools off the payroll', () => {
    const b = computeBudget({ ...base, cumulativeCuts: 10, schools: { 'rosa-parks': { ...rosaParks, open: false } } });
    expect(amount(b, 'earlierCuts')).toBeCloseTo(10 * 155_000 * 1.035, 0);
    expect(amount(b, 'homerooms')).toBeCloseTo(0);
    expect(amount(b, 'stateK8')).toBeGreaterThan(0);
  });

  it('takes cut homerooms off the homeroom line instead of the earlier-cuts line', () => {
    const big: SchoolState = { ...rosaParks, enrollment: 520, byGrade: [80, 80, 80, 80, 100, 100, 0, 0, 0] };
    const input = { ...base, schools: { 'rosa-parks': big }, cumulativeCuts: 10 };
    const none = computeBudget(input);
    const two = computeBudget({ ...input, homeroomsCut: 2 });
    expect(amount(two, 'homerooms')! - amount(none, 'homerooms')!).toBeCloseTo(2 * 159_600 * 1.035, 0);
    expect(amount(two, 'earlierCuts')).toBeCloseTo(8 * 155_000 * 1.035, 0);
  });

  it('adds the state funding card on all state revenue as its own line', () => {
    const flat = computeBudget(base);
    expect(amount(flat, 'stateFunding')).toBe(0);
    const up = computeBudget({ ...base, stateFunding: 1.05 });
    const stateRevenue = amount(flat, 'stateK8')! + M.otherStudents * statePerStudent();
    expect(amount(up, 'stateFunding')).toBeCloseTo(0.05 * stateRevenue, 0);
    expect(up.gap - flat.gap).toBeCloseTo(0.05 * stateRevenue, 0);
    expect(up.spending).toBeCloseTo(flat.spending - (up.autoCutPositions - flat.autoCutPositions) * 155_000 * 1.035, 0);
  });

  it('books the levy rate in force and a bill for a measure on the ballot', () => {
    expect(amount(computeBudget({ ...base, levyRate: 1.99 }), 'levy')).toBeCloseTo(levyRevenue(1.99), 0);
    expect(amount(computeBudget(base), 'election')).toBeUndefined();
    expect(amount(computeBudget({ ...base, election: true }), 'election')).toBeCloseTo(-M.electionBill * 1.035, 0);
  });

  it('cuts positions for the shortfall left after the reserve draw', () => {
    const b = computeBudget({ ...base, restRevenue: -10_000_000 });
    expect(b.autoCutPositions).toBe(Math.ceil((-b.gap - 5_000_000) / (155_000 * 1.035)));
    expect(computeBudget({ ...base, restRevenue: 50_000_000 }).autoCutPositions).toBe(0);
  });

  it('rehires cut positions with the surplusRehire share of a surplus', () => {
    const input = { ...base, restRevenue: 50_000_000, cumulativeCuts: 1_000 };
    const kept = computeBudget(input);
    expect(kept.rehired).toBe(0);
    setModelParams({ surplusRehire: 0.5 });
    const b = computeBudget(input);
    const position = 155_000 * 1.035;
    expect(b.rehired).toBe(Math.floor((0.5 * b.gap) / position));
    expect(b.reservesAfter).toBeCloseTo(kept.reservesAfter - b.rehired! * position, 0);
    expect(b.spending).toBeCloseTo(kept.spending + b.rehired! * position, 0);
    expect(computeBudget({ ...input, cumulativeCuts: 3 }).rehired).toBe(3);
  });

  it('rehires only from the surplus above the reserve policy, so no mid-year cuts follow', () => {
    setModelParams({ surplusRehire: 1 });
    const b = computeBudget({ ...base, reserves: 0, restRevenue: 450_000_000, restCost: 420_000_000, cumulativeCuts: 300 });
    const position = 155_000 * 1.035;
    expect(b.gap).toBeGreaterThan(30e6);
    expect(b.rehired).toBeGreaterThan(50);
    expect(b.rehired).toBeLessThan(300);
    expect(b.rehired! * position).toBeLessThan(b.gap);
    expect(b.reservesAfter).toBeGreaterThanOrEqual(M.reservePolicy * b.spending);
    expect(b.reservesAfter).toBeLessThan(M.reservePolicy * b.spending + 2 * position);
    expect(b.midYearCuts).toBe(0);
  });
});

describe('state funding card', () => {
  const ceiling = 12.56 / 11.36 - 1;

  it('draws each biennium from flat to $12.56B against $11.36B', () => {
    const draws = Array.from({ length: 200 }, (_, i) => stateFundingGrowth(i, 2027 + 2 * (i % 5)));
    for (const g of draws) {
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(ceiling);
    }
    expect(Math.min(...draws)).toBeLessThan(0.1 * ceiling);
    expect(Math.max(...draws)).toBeGreaterThan(0.9 * ceiling);
    expect(stateFundingGrowth(7, 2029)).toBe(stateFundingGrowth(7, 2029));
    expect(stateFundingGrowth(7, 2029)).not.toBe(stateFundingGrowth(7, 2031));
  });

  it('compounds biennia and plans odd years flat until the spring vote', () => {
    const g27 = 1 + stateFundingGrowth(7, 2027);
    const g29 = 1 + stateFundingGrowth(7, 2029);
    expect(stateFundingLevel(7, 2027, 'january')).toBe(1);
    expect(stateFundingLevel(7, 2027, 'june')).toBe(g27);
    expect(stateFundingLevel(7, 2028, 'january')).toBe(g27);
    expect(stateFundingLevel(7, 2028, 'june')).toBe(g27);
    expect(stateFundingLevel(7, 2029, 'january')).toBe(g27);
    expect(stateFundingLevel(7, 2029, 'june')).toBeCloseTo(g27 * g29, 12);
  });
});
