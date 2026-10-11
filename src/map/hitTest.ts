import type { Point } from '../data';
import type { SchoolId } from '../sim/types';

export const PICK_RADIUS_PX = 22;

export interface ScreenBadge {
  id: SchoolId;
  x: number;
  y: number;
}

export type Tap = { kind: 'none' } | { kind: 'select'; id: SchoolId } | { kind: 'pick'; ids: SchoolId[] };

export function resolveTap(badges: ScreenBadge[], [x, y]: Point, radius = PICK_RADIUS_PX): Tap {
  const near = badges
    .map((b) => ({ id: b.id, d: Math.hypot(b.x - x, b.y - y) }))
    .filter((b) => b.d <= radius)
    .sort((a, b) => a.d - b.d);
  if (near.length === 0) return { kind: 'none' };
  if (near.length === 1) return { kind: 'select', id: near[0].id };
  return { kind: 'pick', ids: near.map((b) => b.id) };
}
