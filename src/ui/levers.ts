import type { Policy, Range } from '../sim/types';

export const CLASS_SIZE = { min: 22, max: 28, step: 1 } as const;
/** Oregon's local-option limit is unverified [V]. */
export const LEVY = { min: 0, max: 2.0, step: 0.1 } as const;
export const RESERVE_STEP = 1_000_000;

/** Each student of class size moves $3–5M a year [I]. */
const CLASS_SIZE_SAVING: Range = { lo: 3_000_000, hi: 5_000_000 };
/** $1.99 per $1,000 projects $103.9M [F]. */
const LEVY_PER_DOLLAR_RATE = 103_900_000 / 1.99;
/** Automatic cuts cost about $155K a position [I]. */
export const POSITION_COST = 155_000;

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

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function classSizeChip(size: number, base: number): Chip {
  const delta = scale(CLASS_SIZE_SAVING, size - base);
  return { seats: '—', walk: '—', now: delta, atMaturity: delta };
}

export function levyChip(rate: number, base: number): Chip {
  const delta = point(Math.round((rate - base) * LEVY_PER_DOLLAR_RATE));
  return { seats: '—', walk: '—', now: delta, atMaturity: delta };
}

/** A reserve draw helps once. */
export function reserveChip(draw: number): Chip {
  return { seats: '—', walk: '—', now: point(draw), atMaturity: point(0) };
}

/** The draft's effect on this year's gap, measured against the policy in force. */
export function draftDelta(draft: Policy, base: Policy): Range {
  const chips = [
    classSizeChip(draft.k5ClassSize, base.k5ClassSize),
    levyChip(draft.levyRate, base.levyRate),
    reserveChip(draft.reserveDraw),
  ];
  return chips.reduce((sum, c) => ({ lo: sum.lo + c.now.lo, hi: sum.hi + c.now.hi }), point(0));
}

export function previewGap(gap: number, draft: Policy, base: Policy): Range {
  const d = draftDelta(draft, base);
  return { lo: gap + d.lo, hi: gap + d.hi };
}

export function autoCutPositions(gap: number): number {
  return gap >= 0 ? 0 : Math.round(-gap / POSITION_COST);
}

export function midpoint(r: Range): number {
  return (r.lo + r.hi) / 2;
}
