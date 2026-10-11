import { describe, expect, it } from 'vitest';
import { ZOOM_LEVELS, levelFactor, snapLevel, stepLevel } from './zoom';

describe('zoom snapping', () => {
  it('uses 1x, 3x and 6x of the fitted scale', () => {
    expect(ZOOM_LEVELS.map(levelFactor)).toEqual([1, 3, 6]);
  });

  it('snaps a free zoom to the nearest level in log space', () => {
    expect(snapLevel(0.2)).toBe('district');
    expect(snapLevel(1.7)).toBe('district');
    expect(snapLevel(1.8)).toBe('neighborhood');
    expect(snapLevel(4.2)).toBe('neighborhood');
    expect(snapLevel(4.3)).toBe('street');
    expect(snapLevel(50)).toBe('street');
  });

  it('steps between levels and stops at the ends', () => {
    expect(stepLevel('district', 1)).toBe('neighborhood');
    expect(stepLevel('neighborhood', 1)).toBe('street');
    expect(stepLevel('street', 1)).toBe('street');
    expect(stepLevel('neighborhood', -1)).toBe('district');
    expect(stepLevel('district', -1)).toBe('district');
  });
});
