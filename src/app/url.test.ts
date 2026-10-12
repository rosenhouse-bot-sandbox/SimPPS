import { describe, expect, it } from 'vitest';
import { readModel, readUrl, writeUrl } from './url';

describe('url', () => {
  it('reads the seed and a known start', () => {
    expect(readUrl('?seed=abc&start=scenario-a')).toEqual({ seed: 'abc', start: 'scenario-a' });
    expect(readUrl('?start=nope')).toEqual({ seed: null, start: null });
    expect(readUrl('')).toEqual({ seed: null, start: null });
  });

  it('writes the seed and start, keeping other params', () => {
    expect(writeUrl('?x=1', 'abc', 'scenario-b')).toBe('?x=1&seed=abc&start=scenario-b');
    expect(writeUrl('?seed=old&start=scenario-a', 'abc', null)).toBe('?seed=abc');
  });

  it('reads model overrides, ignoring unknown keys and bad numbers', () => {
    expect(readModel('?seed=a&m.leaveRate=0.02&m.closureOneTime.lo=200000&m.nope=1&m.returnRate=x&m.awayShare=3&m.overload=0x4&m.kCapture2025=0')).toEqual({
      leaveRate: 0.02,
      'closureOneTime.lo': 200_000,
    });
    expect(readModel('?seed=a')).toEqual({});
  });

  it('writes only the overrides it is given, replacing old ones', () => {
    expect(writeUrl('?seed=a&m.returnRate=0.1', 'abc', null, { leaveRate: 0.02 })).toBe('?seed=abc&m.leaveRate=0.02');
  });
});
