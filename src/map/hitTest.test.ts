import { describe, expect, it } from 'vitest';
import { PICK_RADIUS_PX, resolveTap } from './hitTest';

const badges = [
  { id: 'a', x: 100, y: 100 },
  { id: 'b', x: 115, y: 100 },
  { id: 'c', x: 300, y: 300 },
];

describe('resolveTap', () => {
  it('selects the only badge within reach', () => {
    expect(resolveTap(badges, [305, 290])).toEqual({ kind: 'select', id: 'c' });
  });

  it('opens a picker, nearest first, when two badges are within reach', () => {
    expect(resolveTap(badges, [112, 101])).toEqual({ kind: 'pick', ids: ['b', 'a'] });
  });

  it('ignores taps farther than 22 px', () => {
    expect(PICK_RADIUS_PX).toBe(22);
    expect(resolveTap(badges, [323, 300])).toEqual({ kind: 'none' });
    expect(resolveTap(badges, [322, 300])).toEqual({ kind: 'select', id: 'c' });
  });
});
