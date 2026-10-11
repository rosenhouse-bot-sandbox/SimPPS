import type { Point } from '../data';
import { cellAtPoint, CELL_METERS } from '../sim';

const STEP = CELL_METERS / 4;

/** Cells under a straight drag in world meters, in order, each once. */
export function strokeCells(from: Point, to: Point): number[] {
  const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / STEP));
  const out = new Set<number>();
  for (let i = 0; i <= n; i++) {
    const c = cellAtPoint([from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);
    if (c >= 0) out.add(c);
  }
  return [...out];
}
