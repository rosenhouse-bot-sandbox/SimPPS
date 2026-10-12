import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, newGame } from '.';
import { EDITABLE_PATHS, LIMITS, paramError, type Model } from './model';
import { stepYear } from './step';

/** Each parameter's extremes, both ends of a range together. */
export const EXTREMES = [
  ...new Set(EDITABLE_PATHS.map((p) => p.split('.')[0] as keyof Model)),
].flatMap((key) => {
  const [min, max] = LIMITS[key] as readonly [number, number];
  const paths = EDITABLE_PATHS.filter((p) => p.split('.')[0] === key);
  return [min, max].map((v) => Object.fromEntries(paths.map((p) => [p, v])) as Record<string, number>);
});

/** The `part`th of `parts` slices of EXTREMES, so test files can share the work. */
export function checkExtremes(part: number, parts: number) {
  describe('a parameter at its limit', () => {
    it.each(EXTREMES.filter((_, i) => i % parts === part).map((m) => [JSON.stringify(m), m] as const))(
      '%s builds a game and steps a year',
      (_, model) => {
        for (const [path, v] of Object.entries(model)) expect(paramError(path, v, model), path).toBeNull();
        const t0 = performance.now();
        const { next } = stepYear(newGame({ seed: 'limits', model }), DEFAULT_POLICY);
        expect(performance.now() - t0).toBeLessThan(10_000);
        for (const [dial, v] of Object.entries(next.dials)) expect(Number.isFinite(v), dial).toBe(true);
        expect(Math.abs(next.dials.gap)).toBeLessThan(2e9);
      },
    );
  });
}
