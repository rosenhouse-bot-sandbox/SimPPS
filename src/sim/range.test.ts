import { describe, expect, it } from 'vitest';
import { modeledRange } from './range';

describe('modeledRange', () => {
  it('brackets a modeled count by about 5% plus 2', () => {
    expect(modeledRange(200)).toEqual({ lo: 188, hi: 212 });
    expect(modeledRange(0)).toEqual({ lo: 0, hi: 2 });
  });
});
