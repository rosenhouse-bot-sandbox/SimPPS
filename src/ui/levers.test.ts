import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, levyRevenue, newGame, previewBudget, type Policy } from '../sim';
import { M } from '../sim/model';
import { classSizeChip, levyChip, reserveChip } from './levers';

describe('lever arithmetic', () => {
  it('prices a class size step at $3-5M a year, now and at maturity', () => {
    expect(classSizeChip(25, 24).now).toEqual({ lo: 3e6, hi: 5e6 });
    expect(classSizeChip(22, 24).atMaturity).toEqual({ lo: -10e6, hi: -6e6 });
    expect(classSizeChip(24, 24).seats).toBe('—');
  });

  it('loses the whole $103.9M when the levy lapses', () => {
    expect(levyChip(0, 1.99).now.lo).toBeCloseTo(-103_900_000, -3);
  });

  it('counts a reserve draw once', () => {
    const c = reserveChip(5e6);
    expect(c.now.lo).toBe(5e6);
    expect(c.atMaturity.hi).toBe(0);
  });
});

describe('lever chips against the sim', () => {
  const game = newGame({ seed: 'chips' });
  const base = previewBudget(game, DEFAULT_POLICY);
  const delta = (p: Partial<Policy>) => previewBudget(game, { ...DEFAULT_POLICY, ...p }).gap - base.gap;

  it.each([22, 23, 25, 26, 28])('brackets the sim for K-5 class size %i, give or take lumpy homerooms', (size) => {
    const chip = classSizeChip(size, 24).now;
    const sim = delta({ k5ClassSize: size });
    const lumps = 500_000 * Math.abs(size - 24);
    expect(sim).toBeGreaterThanOrEqual(chip.lo - lumps);
    expect(sim).toBeLessThanOrEqual(chip.hi + lumps);
  });

  it.each([0, 0.5, 1, 1.89, 2])('matches the sim for a levy of $%d, election bill included', (rate) => {
    const plan = previewBudget(game, { ...DEFAULT_POLICY, levyRate: rate });
    const bill = -(plan.lines.find((l) => l.key === 'election')?.amount ?? 0);
    expect(bill > 0).toBe(rate > 0);
    const chip = levyChip(rate, 1.99, bill);
    expect(chip.now.lo).toBe(chip.now.hi);
    expect(chip.now.lo).toBeCloseTo(delta({ levyRate: rate }), 0);
    expect(chip.atMaturity.lo).toBeCloseTo(chip.now.lo + bill, 0);
  });

  it.each([0.5, 1.49, 2])('moves only the election bill now for a November vote on $%d', (rate) => {
    const policy = { levyRate: rate, levyElection: 'november' as const };
    const bill = -(previewBudget(game, { ...DEFAULT_POLICY, ...policy }).lines.find((l) => l.key === 'election')?.amount ?? 0);
    const chip = levyChip(rate, 1.99, bill, 'november');
    expect(chip.now.lo).toBeCloseTo(delta(policy), 0);
    expect(chip.atMaturity.lo).toBeCloseTo(levyRevenue(rate) - levyRevenue(1.99), 0);
  });

  it('agrees on the positions a reserve draw saves', () => {
    const draw = 10e6;
    const saved = base.autoCutPositions - previewBudget(game, { ...DEFAULT_POLICY, reserveDraw: draw }).autoCutPositions;
    expect(saved * M.positionCost).toBeCloseTo(reserveChip(draw).now.lo, -6);
  });
});
