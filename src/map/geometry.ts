import type { Ring } from '../data';

export function ringsToPath(rings: Ring[]): string {
  return rings
    .map((ring) => ring.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x)} ${Math.round(y)}`).join('') + 'Z')
    .join('');
}

/** Even-odd test, so inner rings punch holes. */
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
