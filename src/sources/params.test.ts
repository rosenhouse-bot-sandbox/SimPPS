import { describe, expect, it } from 'vitest';
import { MODEL_DEFAULTS } from '../sim/model';
import { getSource } from './registry';
import { MODEL_PARAMS } from './model';
import { cleanOverrides, EDITABLE_PATHS, paramError } from './params';

describe('model parameters', () => {
  it('note and source every parameter, with a tag', () => {
    expect(Object.keys(MODEL_PARAMS).sort()).toEqual(Object.keys(MODEL_DEFAULTS).sort());
    for (const [key, p] of Object.entries(MODEL_PARAMS)) {
      expect(getSource(p.source), key).toBeDefined();
      expect(p.note, key).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('edits scalars and range ends, not arrays or the levy term', () => {
    expect(EDITABLE_PATHS).toContain('leaveRate');
    expect(EDITABLE_PATHS).toContain('closureOneTime.lo');
    expect(EDITABLE_PATHS).not.toContain('staffSteps');
    expect(EDITABLE_PATHS).not.toContain('levyRate');
  });

  it('rejects values outside sensible bounds and a range whose ends cross', () => {
    expect(paramError('leaveRate', 0.5, {})).toBeNull();
    expect(paramError('leaveRate', 1.5, {})).toBe('Use 0 to 1.');
    expect(paramError('leaveRate', NaN, {})).toBe('Enter a number.');
    expect(paramError('positionCost', 0, {})).toBe('Use at least 1.');
    expect(paramError('closureOneTime.lo', 700_000, {})).toBe('Keep low at or below high.');
    expect(paramError('closureOneTime.lo', 700_000, { 'closureOneTime.hi': 800_000 })).toBeNull();
  });

  it('keeps only valid overrides that differ from the defaults', () => {
    expect(
      cleanOverrides({ leaveRate: 0.02, returnRate: MODEL_DEFAULTS.returnRate, nope: 1, levyRate: 3, awayShare: 2, 'busRider.lo': 5_000 }),
    ).toEqual({ leaveRate: 0.02 });
  });
});
