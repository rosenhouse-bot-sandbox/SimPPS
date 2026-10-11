import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, newGame, previewBudget, type Policy } from '../sim';
import { M } from '../sim/model';
import { classSizeChip, clamp, levyChip, reserveChip } from './levers';

describe('lever arithmetic', () => {
  it('prices a class size step at $3-5M a year, now and at maturity', () => {
    expect(classSizeChip(25, 24).now).toEqual({ lo: 3e6, hi: 5e6 });
    expect(classSizeChip(22, 24).atMaturity).toEqual({ lo: -10e6, hi: -6e6 });
    expect(classSizeChip(24, 24).seats).toBe('—');
  });

  it('scales the levy from $1.99 = $103.9M', () => {
    expect(levyChip(0, 1.99).now).toEqual({ lo: -103_900_000, hi: -103_900_000 });
  });

  it('counts a reserve draw once', () => {
    const c = reserveChip(5e6);
    expect(c.now.lo).toBe(5e6);
    expect(c.atMaturity.hi).toBe(0);
  });

  it('clamps', () => {
    expect(clamp(30, 22, 28)).toBe(28);
    expect(clamp(20, 22, 28)).toBe(22);
  });
});

describe('lever chips against the sim', () => {
  const game = newGame({ seed: 'chips' });
  const base = previewBudget(game, DEFAULT_POLICY);
  const delta = (p: Partial<Policy>) => previewBudget(game, { ...DEFAULT_POLICY, ...p }).gap - base.gap;

  it.each([22, 23, 25, 26, 28])('brackets the sim for K-5 class size %i', (size) => {
    const chip = classSizeChip(size, 24).now;
    const sim = delta({ k5ClassSize: size });
    expect(sim).toBeGreaterThanOrEqual(chip.lo);
    expect(sim).toBeLessThanOrEqual(chip.hi);
  });

  it.each([0, 1, 1.89, 2])('agrees in sign and rough size for a levy of $%d', (rate) => {
    const chip = levyChip(rate, 1.99).now.lo;
    const ratio = delta({ levyRate: rate }) / chip;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });

  it('agrees on the positions a reserve draw saves', () => {
    const draw = 10e6;
    const saved = base.autoCutPositions - previewBudget(game, { ...DEFAULT_POLICY, reserveDraw: draw }).autoCutPositions;
    expect(saved * M.positionCost).toBeCloseTo(reserveChip(draw).now.lo, -6);
  });
});
