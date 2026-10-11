import type { Point, Ring } from '../data';

export function ringsToPath(rings: Ring[]): string {
  return rings
    .map((ring) => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x)} ${Math.round(y)}`).join('') + 'Z')
    .join('');
}

/** Even-odd test, so inner rings punch holes. */
export function pointInRings([x, y]: Point, rings: Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const SHORT_NAMES: Record<string, string> = {
  'Dr. Martin Luther King Jr. School': 'MLK Jr.',
  'Metropolitan Learning Center': 'MLC',
};

export function shortName(name: string): string {
  return (
    SHORT_NAMES[name] ??
    name.replace(/ (Polytechnic High|High|Elementary|Middle|K-8)? ?School$| Program \(K-8\)$/, '').trim()
  );
}
