export type ZoomLevel = 'district' | 'neighborhood' | 'street';

export const ZOOM_LEVELS: ZoomLevel[] = ['district', 'neighborhood', 'street'];

const FACTORS: Record<ZoomLevel, number> = { district: 1, neighborhood: 3, street: 6 };

/** Scale relative to the view that fits the whole district. */
export function levelFactor(level: ZoomLevel): number {
  return FACTORS[level];
}

export function snapLevel(factor: number): ZoomLevel {
  const dist = (l: ZoomLevel) => Math.abs(Math.log(factor / FACTORS[l]));
  return ZOOM_LEVELS.reduce((best, l) => (dist(l) < dist(best) ? l : best));
}

export function stepLevel(level: ZoomLevel, dir: 1 | -1): ZoomLevel {
  const i = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, ZOOM_LEVELS.indexOf(level) + dir));
  return ZOOM_LEVELS[i];
}
