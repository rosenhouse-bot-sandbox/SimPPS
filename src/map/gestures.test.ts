import { describe, expect, it } from 'vitest';
import { Gestures, TAP_SLOP_PX } from './gestures';

describe('Gestures', () => {
  it('reports a tap when one finger lifts without moving past the slop', () => {
    const g = new Gestures();
    g.down(1, [100, 100]);
    expect(g.move(1, [103, 102])).toBeNull();
    expect(g.up(1, [103, 102])).toEqual({ kind: 'tap', at: [103, 102] });
  });

  it('pans with one finger once it moves past the slop', () => {
    const g = new Gestures();
    g.down(1, [100, 100]);
    expect(g.move(1, [100 + TAP_SLOP_PX + 1, 100])).toEqual({ kind: 'pan', dx: TAP_SLOP_PX + 1, dy: 0 });
    expect(g.move(1, [120, 95])).toEqual({ kind: 'pan', dx: 11, dy: -5 });
    expect(g.up(1, [120, 95])).toBeNull();
  });

  it('pinches about the midpoint and ends without a tap', () => {
    const g = new Gestures();
    g.down(1, [100, 100]);
    g.down(2, [200, 100]);
    expect(g.move(2, [300, 100])).toEqual({ kind: 'pinch', factor: 2, center: [200, 100], dx: 50, dy: 0 });
    expect(g.up(2, [300, 100])).toEqual({ kind: 'pinchEnd', center: [200, 100] });
    expect(g.move(1, [101, 100])).toEqual({ kind: 'pan', dx: 1, dy: 0 });
    expect(g.up(1, [101, 100])).toBeNull();
  });

  it('ignores pointers it never saw go down', () => {
    const g = new Gestures();
    expect(g.move(7, [1, 1])).toBeNull();
    expect(g.up(7, [1, 1])).toBeNull();
  });
});
