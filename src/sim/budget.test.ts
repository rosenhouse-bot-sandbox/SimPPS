import { describe, expect, it } from 'vitest';
import { classesFor, computeBudget, levyRevenue, otherStaff, revenuePerStudent } from './budget';
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
    homerooms: 6,
    blendedHomerooms: 0,
  };
  const base = {
    year: 2028,
    schools: { 'rosa-parks': rosaParks },
    policy: { k5ClassSize: 24, levyRate: 0, reserveDraw: 5_000_000, closures: [] },
    reserves: 20_000_000,
    cumulativeCuts: 0,
    restRevenue: 0,
    restCost: 0,
  };
  const amount = (b: ReturnType<typeof computeBudget>, key: string) => b.lines.find((l) => l.key === key)?.amount;

  it('prices one school from its cohorts, staff step and square feet, grown 3.5% a year', () => {
    const b = computeBudget(base);
    expect(amount(b, 'homerooms')).toBeCloseTo(-6 * 159_600 * 1.035, 0);
    expect(amount(b, 'staff')).toBeCloseTo(-6 * 155_000 * 1.035, 0);
    expect(amount(b, 'plant')).toBeCloseTo(-46_657 * 9.57 * 1.035, 0);
    expect(amount(b, 'stateK8')).toBeCloseTo(144 * revenuePerStudent(0.6294), 0);
  });

  it('carries earlier cuts as savings and keeps closed schools off the payroll', () => {
    const b = computeBudget({ ...base, cumulativeCuts: 10, schools: { 'rosa-parks': { ...rosaParks, open: false } } });
    expect(amount(b, 'earlierCuts')).toBeCloseTo(10 * 155_000 * 1.035, 0);
    expect(amount(b, 'homerooms')).toBeCloseTo(0);
    expect(amount(b, 'stateK8')).toBeGreaterThan(0);
  });

  it('cuts positions for the shortfall left after the reserve draw', () => {
    const b = computeBudget({ ...base, restRevenue: -10_000_000 });
    expect(b.autoCutPositions).toBe(Math.ceil((-b.gap - 5_000_000) / (155_000 * 1.035)));
    expect(computeBudget({ ...base, restRevenue: 50_000_000 }).autoCutPositions).toBe(0);
  });
});
