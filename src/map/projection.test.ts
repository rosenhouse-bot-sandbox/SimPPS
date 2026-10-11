import { describe, expect, it } from 'vitest';
import { boundsOf, clampCenter, fitView, panBy, toScreen, toWorld, zoomAt } from './projection';

describe('projection', () => {
  it('finds the bounds of points', () => {
    expect(boundsOf([[1, 5], [-3, 2], [4, -1]])).toEqual({ minX: -3, minY: -1, maxX: 4, maxY: 5 });
  });

  it('fits bounds inside the padded viewport and centers them', () => {
    const v = fitView({ minX: 0, minY: 0, maxX: 1000, maxY: 500 }, 220, 400, 10);
    expect(v.scale).toBeCloseTo(0.2);
    expect(toScreen(v, [500, 250])).toEqual([110, 200]);
    expect(toScreen(v, [0, 250])[0]).toBeCloseTo(10);
  });

  it('round-trips screen and world points', () => {
    const v = { scale: 0.3, tx: 12, ty: -40 };
    const [x, y] = toWorld(v, toScreen(v, [123, -456]));
    expect(x).toBeCloseTo(123);
    expect(y).toBeCloseTo(-456);
  });

  it('keeps the anchor fixed while zooming', () => {
    const v = { scale: 0.1, tx: 50, ty: 60 };
    const before = toWorld(v, [100, 200]);
    const z = zoomAt(v, 0.4, [100, 200]);
    expect(z.scale).toBe(0.4);
    const [x, y] = toScreen(z, before);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(200);
  });

  it('pans by screen pixels', () => {
    expect(panBy({ scale: 2, tx: 1, ty: 2 }, 10, -5)).toEqual({ scale: 2, tx: 11, ty: -3 });
  });

  it('keeps the view centered inside the bounds', () => {
    const b = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const far = { scale: 1, tx: -500, ty: 300 };
    expect(toWorld(clampCenter(far, b, 20, 20), [10, 10])).toEqual([100, 0]);
    const inside = { scale: 1, tx: -40, ty: -40 };
    expect(clampCenter(inside, b, 20, 20)).toEqual(inside);
  });
});
