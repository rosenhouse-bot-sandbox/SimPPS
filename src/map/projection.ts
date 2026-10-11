import type { Point } from '../data';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** screen = world * scale + (tx, ty), in CSS pixels. */
export interface View {
  scale: number;
  tx: number;
  ty: number;
}

export function boundsOf(points: Iterable<Point>): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of points) {
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  }
  return b;
}

export function fitView(b: Bounds, width: number, height: number, pad = 16): View {
  const scale = Math.min((width - 2 * pad) / (b.maxX - b.minX), (height - 2 * pad) / (b.maxY - b.minY));
  return centerOn({ scale, tx: 0, ty: 0 }, [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2], width, height);
}

export function centerOn(v: View, world: Point, width: number, height: number): View {
  return { scale: v.scale, tx: width / 2 - world[0] * v.scale, ty: height / 2 - world[1] * v.scale };
}

export function toScreen(v: View, [x, y]: Point): Point {
  return [x * v.scale + v.tx, y * v.scale + v.ty];
}

export function toWorld(v: View, [x, y]: Point): Point {
  return [(x - v.tx) / v.scale, (y - v.ty) / v.scale];
}

export function zoomAt(v: View, scale: number, anchor: Point): View {
  const [wx, wy] = toWorld(v, anchor);
  return { scale, tx: anchor[0] - wx * scale, ty: anchor[1] - wy * scale };
}

export function panBy(v: View, dx: number, dy: number): View {
  return { scale: v.scale, tx: v.tx + dx, ty: v.ty + dy };
}

export function clampCenter(v: View, b: Bounds, width: number, height: number): View {
  const [x, y] = toWorld(v, [width / 2, height / 2]);
  const clamped: Point = [Math.min(b.maxX, Math.max(b.minX, x)), Math.min(b.maxY, Math.max(b.minY, y))];
  return clamped[0] === x && clamped[1] === y ? v : centerOn(v, clamped, width, height);
}
