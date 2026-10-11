import type { Point } from '../data';

export const TAP_SLOP_PX = 8;

export type Gesture =
  | { kind: 'tap'; at: Point }
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'pinch'; factor: number; center: Point; dx: number; dy: number }
  | { kind: 'pinchEnd'; center: Point }
  | { kind: 'stroke'; from: Point; to: Point }
  | { kind: 'strokeEnd' }
  | { kind: 'strokeCancel' };

/**
 * Turns raw pointer events into tap, one-finger pan and two-finger pinch. With `paint`, one finger
 * strokes instead of panning or tapping.
 */
export class Gestures {
  paint = false;
  private pointers = new Map<number, Point>();
  private start: Point | null = null;
  private dragging = false;
  private multi = false;
  private stroking = false;

  down(id: number, p: Point): Gesture | null {
    let out: Gesture | null = null;
    if (this.pointers.size === 0) {
      this.start = p;
      this.dragging = false;
      this.multi = false;
      this.stroking = this.paint;
      if (this.stroking) out = { kind: 'stroke', from: p, to: p };
    } else {
      this.multi = true;
      if (this.stroking) out = { kind: 'strokeCancel' };
      this.stroking = false;
    }
    this.pointers.set(id, p);
    return out;
  }

  move(id: number, p: Point): Gesture | null {
    const last = this.pointers.get(id);
    if (!last) return null;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      this.pointers.set(id, p);
      const [c, d] = [...this.pointers.values()];
      const before = mid(a, b);
      const after = mid(c, d);
      return { kind: 'pinch', factor: dist(c, d) / dist(a, b), center: after, dx: after[0] - before[0], dy: after[1] - before[1] };
    }
    if (this.stroking) {
      this.pointers.set(id, p);
      return { kind: 'stroke', from: last, to: p };
    }
    if (!this.dragging && !this.multi && dist(p, this.start!) <= TAP_SLOP_PX) return null;
    this.dragging = true;
    this.pointers.set(id, p);
    return { kind: 'pan', dx: p[0] - last[0], dy: p[1] - last[1] };
  }

  up(id: number, p: Point): Gesture | null {
    if (!this.pointers.has(id)) return null;
    const wasPinch = this.pointers.size === 2;
    const center = wasPinch ? mid(...([...this.pointers.values()] as [Point, Point])) : p;
    this.pointers.delete(id);
    if (this.stroking) {
      this.stroking = false;
      return { kind: 'strokeEnd' };
    }
    if (wasPinch) return { kind: 'pinchEnd', center };
    if (this.pointers.size === 0 && !this.dragging && !this.multi) return { kind: 'tap', at: p };
    return null;
  }

  cancel(id: number): void {
    this.pointers.delete(id);
    this.multi = true;
    this.stroking = false;
  }
}

function mid(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
