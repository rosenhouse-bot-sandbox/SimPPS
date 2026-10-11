import { levyRevenue } from '../sim';
import type { Range } from '../sim/types';

export const CLASS_SIZE = { min: 22, max: 28, step: 1 } as const;
/** Oregon's local-option limit is unverified [V]. */
export const LEVY = { min: 0, max: 2.0, step: 0.1 } as const;
export const RESERVE_STEP = 1_000_000;

/** Each student of class size moves $3–5M a year [I]. */
const CLASS_SIZE_SAVING: Range = { lo: 3_000_000, hi: 5_000_000 };

/** Arithmetic for one edit. Dollars per year; positive helps the gap. */
export interface Chip {
  seats: string;
  walk: string;
  now: Range;
  atMaturity: Range;
}

function point(n: number): Range {
  return { lo: n, hi: n };
}

function scale(r: Range, k: number): Range {
  const a = r.lo * k;
  const b = r.hi * k;
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}

export function classSizeChip(size: number, base: number): Chip {
  const delta = scale(CLASS_SIZE_SAVING, size - base);
  return { seats: '—', walk: '—', now: delta, atMaturity: delta };
}

export function levyChip(rate: number, base: number): Chip {
  const delta = point(levyRevenue(rate) - levyRevenue(base));
  return { seats: '—', walk: '—', now: delta, atMaturity: delta };
}

/** A reserve draw helps once. */
export function reserveChip(draw: number): Chip {
  return { seats: '—', walk: '—', now: point(draw), atMaturity: point(0) };
}
