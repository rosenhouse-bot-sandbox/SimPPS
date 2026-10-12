import { LIMITS, type Model } from '../sim/model';
import { MODEL_PARAMS, type ParamInfo } from './model';

export function paramInfo(path: string): ParamInfo {
  return MODEL_PARAMS[path.split('.')[0] as keyof Model];
}

/** Plain decimal or exponent notation, with a comma allowed as the decimal mark. Anything else is NaN. */
export function parseParam(text: string): number {
  const t = text.trim().replace(',', '.');
  return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t) ? Number(t) : NaN;
}

/** Whether a parameter can go below zero, so its keyboard needs a minus key. */
export function allowsNegative(path: string): boolean {
  const limit = LIMITS[path.split('.')[0] as keyof Model];
  return limit !== 'fixed' && limit[0] < 0;
}
