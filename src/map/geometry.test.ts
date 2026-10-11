import { describe, expect, it } from 'vitest';
import { pointInRings, ringsToPath, shortName } from './geometry';

const square: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];

describe('geometry', () => {
  it('turns rings into one closed SVG path in whole meters', () => {
    expect(ringsToPath([[[0.4, 0], [10.6, 0], [10, 10]], [[1, 1], [2, 2], [1, 2]]])).toBe('M0 0L11 0L10 10ZM1 1L2 2L1 2Z');
  });

  it('tests points against rings with even-odd holes', () => {
    const hole: [number, number][] = [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]];
    expect(pointInRings([2, 2], [square])).toBe(true);
    expect(pointInRings([12, 2], [square])).toBe(false);
    expect(pointInRings([5, 5], [square, hole])).toBe(false);
  });
});

describe('shortName', () => {
  it.each([
    ['Rosa Parks Elementary School', 'Rosa Parks'],
    ['Beaumont Middle School', 'Beaumont'],
    ['César Chávez K-8 School', 'César Chávez'],
    ['Odyssey Program (K-8)', 'Odyssey'],
    ['Beverly Cleary School', 'Beverly Cleary'],
    ['Dr. Martin Luther King Jr. School', 'MLK Jr.'],
    ['Metropolitan Learning Center', 'MLC'],
    ['Rose City Park', 'Rose City Park'],
    ['Benson Polytechnic High School', 'Benson'],
  ])('shortens %s to %s', (name, short) => {
    expect(shortName(name)).toBe(short);
  });
});
