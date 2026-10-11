import { describe, expect, it } from 'vitest';
import { ZONES, type Zone } from '../data';
import { inZone, samplePoint, ZoneIndex } from './geo';
import { stream } from './rng';

const square: Zone = {
  name: 'Square',
  school: 's',
  rings: [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
  ],
};

describe('geo', () => {
  it('treats inner rings as holes', () => {
    expect(inZone([1, 1], square)).toBe(true);
    expect(inZone([5, 5], square)).toBe(false);
    expect(inZone([11, 5], square)).toBe(false);
  });

  it('samples points inside the zone', () => {
    const rand = stream(1);
    for (let i = 0; i < 200; i++) expect(inZone(samplePoint(square, rand), square)).toBe(true);
  });

  it('finds the elementary zone a sampled point falls in', () => {
    const index = new ZoneIndex(ZONES.elementary);
    const rand = stream(2);
    ZONES.elementary.forEach((zone, i) => {
      expect(index.find(samplePoint(zone, rand))).toBe(i);
    });
    expect(index.find([1e7, 1e7])).toBe(-1);
  });
});
