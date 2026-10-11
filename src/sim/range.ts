import type { Range } from './types';

/** The range the UI shows for a modeled count at a real school. */
export function modeledRange(n: number): Range {
  const spread = Math.round(n * 0.05) + 2;
  return { lo: Math.max(0, Math.round(n) - spread), hi: Math.round(n) + spread };
}
