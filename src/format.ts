import type { Range } from './sim/types';

const MINUS = '−';

function sign(n: number): string {
  return n < 0 ? MINUS : '';
}

function trim(x: number): string {
  return x.toFixed(1).replace(/\.0$/, '');
}

export function fmtMoney(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign(n)}$${trim(a / 1e9)}B`;
  if (a >= 1e6) return `${sign(n)}$${trim(a / 1e6)}M`;
  if (a >= 1e3) return `${sign(n)}$${trim(a / 1e3)}K`;
  return `${sign(n)}$${Math.round(a)}`;
}

export function fmtSignedMoney(n: number): string {
  return n > 0 ? `+${fmtMoney(n)}` : fmtMoney(n);
}

export function fmtPct(share: number): string {
  return `${trim(share * 100)}%`;
}

export function fmtCount(n: number): string {
  const a = Math.abs(n);
  if (a >= 10_000) return `${sign(n)}${trim(a / 1000)}K`;
  return `${sign(n)}${Math.round(a).toLocaleString('en-US')}`;
}

/** A modeled range, like "190–225~". */
export function fmtRange(r: Range, fmt: (n: number) => string = fmtCount): string {
  if (r.lo === r.hi) return `${fmt(r.lo)}~`;
  const sep = r.lo < 0 || r.hi < 0 ? ' to ' : '–';
  return `${fmt(r.lo)}${sep}${fmt(r.hi)}~`;
}

function millions(n: number): string {
  return trim(Math.abs(n) / 1e6);
}

/** A modeled money range in millions, like "−$0.3–0.6M~". */
export function fmtMoneyRange(r: Range): string {
  if (r.lo < 0 && r.hi > 0) return `${MINUS}$${millions(r.lo)}M to +$${millions(r.hi)}M~`;
  const [a, b] = [Math.abs(r.lo), Math.abs(r.hi)].sort((x, y) => x - y);
  return `${r.hi < 0 ? MINUS : '+'}$${millions(a)}–${millions(b)}M~`;
}

export function fmtMiles(mi: number, signed = false): string {
  const plus = signed && mi >= 0.05 ? '+' : '';
  return `${plus}${sign(Math.round(mi * 10))}${trim(Math.abs(mi))} mi`;
}
