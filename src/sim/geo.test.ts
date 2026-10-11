import { describe, expect, it } from 'vitest';
import { SCHOOLS, ZONES, type Zone } from '../data';
import { RIVERS } from '../map/rivers';
import { acrossWillamette, inZone, samplePoint, ZoneIndex } from './geo';
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

describe('acrossWillamette', () => {
  const at = (id: string): [number, number] => {
    const s = SCHOOLS.find((x) => x.id === id)!;
    return [s.x, s.y];
  };

  it('splits the west side from the east side', () => {
    expect(acrossWillamette(at('peninsula'), at('rosa-parks'))).toBe(false);
    expect(acrossWillamette(at('forest-park'), at('rosa-parks'))).toBe(true);
    expect(acrossWillamette(at('rosa-parks'), at('forest-park'))).toBe(true);
    expect(acrossWillamette(at('forest-park'), at('chapman'))).toBe(false);
  });

  it('holds the river at its ends', () => {
    const points = RIVERS.find((r) => r.name === 'Willamette')!.points;
    for (const [x, y] of [points[0], points[points.length - 1]]) {
      const beyond = y + (y === points[0][1] ? -1 : 1) * 1e5;
      expect(acrossWillamette([x - 50, beyond], [x + 50, beyond])).toBe(true);
    }
  });
});
