import { M } from './model';
import type { Range } from './types';

/** model.schoolRange: the range the UI shows for a modeled count at a real school. */
export function modeledRange(n: number): Range {
  const spread = Math.round(n * M.rangeShare) + M.rangeExtra;
  return { lo: Math.max(0, Math.round(n) - spread), hi: Math.round(n) + spread };
}
