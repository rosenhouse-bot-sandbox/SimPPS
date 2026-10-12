import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, endYear, newGame } from '.';
import { cleanOverrides, EDITABLE_PATHS, M, MODEL_DEFAULTS, paramError, setModelParams } from './model';

describe('setModelParams', () => {
  it('applies overrides over the defaults, ranges by "lo" and "hi"', () => {
    setModelParams({ trustClosure: 12, 'closureOneTime.lo': 100_000 });
    expect(M.trustClosure).toBe(12);
    expect(M.closureOneTime).toEqual({ lo: 100_000, hi: MODEL_DEFAULTS.closureOneTime.hi });
    setModelParams({ leaveRate: 0.02 });
    expect(M.trustClosure).toBe(MODEL_DEFAULTS.trustClosure);
    expect(M.closureOneTime).toEqual(MODEL_DEFAULTS.closureOneTime);
    expect(M.leaveRate).toBe(0.02);
  });

  it('ignores unknown, fixed, out-of-bounds and non-finite values', () => {
    setModelParams({ nope: 1, staffSteps: 3, levyRate: 2.5, leaveRate: NaN, 'trustStart.mid': 2, returnRate: Infinity, kCapture2025: 0, outsideKids: 1e7 });
    expect(M).toEqual(MODEL_DEFAULTS);
  });

  it('keeps the defaults frozen', () => {
    expect(Object.isFrozen(MODEL_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(MODEL_DEFAULTS.trustStart)).toBe(true);
  });
});

describe('parameter checks', () => {
  it('edits scalars and range ends, not arrays or the levy term', () => {
    expect(EDITABLE_PATHS).toContain('leaveRate');
    expect(EDITABLE_PATHS).toContain('closureOneTime.lo');
    for (const fixed of ['staffSteps', 'closurePhasing', 'levyRate', 'levyThrough', 'levyYears']) expect(EDITABLE_PATHS).not.toContain(fixed);
  });

  it('bounds every parameter around its default', () => {
    expect(paramError('leaveRate', 0.05, {})).toBeNull();
    expect(paramError('leaveRate', 0.5, {})).toBe('Use 0 to 0.1.');
    expect(paramError('leaveRate', NaN, {})).toBe('Enter a number.');
    expect(paramError('kCapture2025', 0, {})).toBe('Use 0.6 to 0.95.');
    expect(paramError('outsideKids', 1e7, {})).toBe('Use 4,000 to 32,000.');
    expect(paramError('stateFunding2025', 1, {})).not.toBeNull();
  });

  it('keeps pairs in order', () => {
    expect(paramError('closureOneTime.lo', 700_000, {})).toBe('Keep at or below closureOneTime.hi.');
    expect(paramError('closureOneTime.lo', 700_000, { 'closureOneTime.hi': 800_000 })).toBeNull();
    expect(paramError('exitMin', 0.5, { exitMax: 0.4 })).toBe('Keep at or below exitMax.');
    expect(paramError('exitMax', 0.6, { exitMin: 0.4 })).toBeNull();
    expect(paramError('stateFundingCeiling', 11.5e9, { stateFunding2025: 12e9 })).toBe('Keep at or above stateFunding2025.');
    expect(paramError('nonFollowerCharter', 0.6, { nonFollowerOtherPps: 0.5 })).toBe('Keep nonFollowerOtherPps + nonFollowerCharter at or below 1.');
  });

  it('keeps only valid overrides that differ from the defaults, dropping both ends of a crossed pair', () => {
    expect(
      cleanOverrides({
        leaveRate: 0.02,
        returnRate: MODEL_DEFAULTS.returnRate,
        nope: 1,
        levyRate: 3,
        awayShare: 2,
        'busRider.lo': 5_000,
        exitMin: 0.4,
        exitMax: 0.3,
        'closureOneTime.lo': 700_000,
        'closureOneTime.hi': 800_000,
      }),
    ).toEqual({ leaveRate: 0.02, 'closureOneTime.lo': 700_000, 'closureOneTime.hi': 800_000 });
  });
});

describe('a game with changed parameters', () => {
  const kidsAfterYear = (model?: Record<string, number>) => endYear(newGame({ seed: 'params', model }), DEFAULT_POLICY).next;

  it('changes a seeded outcome, ghost included, while the defaults reproduce it', () => {
    const before = kidsAfterYear();
    const changed = kidsAfterYear({ leaveRate: 0.05 });
    const again = kidsAfterYear({});
    expect(changed.dials.kids).toBeLessThan(before.dials.kids - 300);
    expect(changed.sim!.ghost!.dials.kids).toBeLessThan(before.sim!.ghost!.dials.kids - 300);
    expect(again.dials).toEqual(before.dials);
  });

  it('keeps a cleaned copy of its own parameters when another game starts in between', () => {
    const model = { leaveRate: 0.05, levyRate: 3, kCapture2025: 0 };
    const game = newGame({ seed: 'params', model });
    newGame({ seed: 'other' });
    expect(endYear(game, DEFAULT_POLICY).next.dials).toEqual(kidsAfterYear({ leaveRate: 0.05 }).dials);
    expect(game.sim!.model).toEqual({ leaveRate: 0.05 });
    model.leaveRate = 0.06;
    expect(game.sim!.model).toEqual({ leaveRate: 0.05 });
  });

  it('shows a changed unit cost in the opening gap', () => {
    const gap = (model?: Record<string, number>) => newGame({ seed: 'params', model }).budget.gap;
    const base = gap();
    expect(gap({ homeroomCost: 100_000 })).toBeGreaterThan(base + 30e6);
    expect(gap({ msClassSize: 15 })).toBeLessThan(base - 5e6);
    expect(gap({ startGap: -100e6 })).toBeCloseTo(base - 34.8e6, -5);
  });
});
