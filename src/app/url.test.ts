import { describe, expect, it } from 'vitest';
import { readUrl, writeUrl } from './url';

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
});
