import { describe, expect, it } from 'vitest';
import { draw, hashString, stream } from './rng';

describe('rng', () => {
  it('hashes strings deterministically and distinctly', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });

  it('draws the same value for the same keys', () => {
    expect(draw(1, 2, 3)).toBe(draw(1, 2, 3));
    expect(draw(1, 2, 3)).not.toBe(draw(1, 2, 4));
    expect(draw(1, 2, 3)).not.toBe(draw(1, 3, 2));
  });

  it('draws uniformly in [0, 1)', () => {
    const n = 20_000;
    const bins = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const u = draw(7, i, 0);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      bins[Math.floor(u * 4)]++;
    }
    for (const b of bins) expect(Math.abs(b / n - 0.25)).toBeLessThan(0.02);
  });

  it('streams repeat from the same seed', () => {
    const a = stream(42);
    const b = stream(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(new Set(xs).size).toBe(3);
  });
});
