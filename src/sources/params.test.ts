import { describe, expect, it } from 'vitest';
import { MODEL_DEFAULTS } from '../sim/model';
import { getSource } from './registry';
import { MODEL_PARAMS } from './model';
import { allowsNegative, parseParam } from './params';

describe('model parameters', () => {
  it('label and source every parameter', () => {
    expect(Object.keys(MODEL_PARAMS).sort()).toEqual(Object.keys(MODEL_DEFAULTS).sort());
    for (const [key, p] of Object.entries(MODEL_PARAMS)) {
      expect(getSource(p.source), key).toBeDefined();
      expect(p.label, key).toMatch(/^[A-Z0-9].*[^.]$/);
    }
  });

  it('reads plain decimals and exponents, with a comma as the decimal mark', () => {
    expect(parseParam('0.5')).toBe(0.5);
    expect(parseParam(' 0,5 ')).toBe(0.5);
    expect(parseParam('-0.02')).toBe(-0.02);
    expect(parseParam('.5')).toBe(0.5);
    expect(parseParam('1e6')).toBe(1e6);
    for (const bad of ['0x10', '', '1,000.5', 'Infinity', '1e', '0b1', '5%']) expect(parseParam(bad), bad).toBeNaN();
  });

  it('offers a minus key only where a parameter can go negative', () => {
    expect(allowsNegative('cohortTrend')).toBe(true);
    expect(allowsNegative('leaveRate')).toBe(false);
  });
});
