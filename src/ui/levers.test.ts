import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '../sim';
import { autoCutPositions, classSizeChip, clamp, levyChip, previewGap, reserveChip } from './levers';

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

  it('adds every edit to the gap', () => {
    const draft = { ...DEFAULT_POLICY, k5ClassSize: 25, reserveDraw: 2e6 };
    expect(previewGap(-65e6, draft, DEFAULT_POLICY)).toEqual({ lo: -60e6, hi: -58e6 });
  });

  it('turns a shortfall into positions', () => {
    expect(autoCutPositions(-43_400_000)).toBe(280);
    expect(autoCutPositions(1)).toBe(0);
  });

  it('clamps', () => {
    expect(clamp(30, 22, 28)).toBe(28);
    expect(clamp(20, 22, 28)).toBe(22);
  });
});
