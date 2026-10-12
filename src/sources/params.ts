import { defaultValue, PARAM_PATHS, type Model } from '../sim/model';
import type { ModelOverrides } from '../sim/types';
import { MODEL_PARAMS, type ParamInfo } from './model';

export function paramInfo(path: string): ParamInfo {
  return MODEL_PARAMS[path.split('.')[0] as keyof Model];
}

/** The parameters a player can change for a new game. */
export const EDITABLE_PATHS = PARAM_PATHS.filter((path) => !paramInfo(path).fixed);

function boundsError(path: string, value: number): string | null {
  if (!Number.isFinite(value)) return 'Enter a number.';
  const { min = 0, max = Infinity } = paramInfo(path);
  if (value >= min && value <= max) return null;
  const n = (x: number) => x.toLocaleString('en-US');
  return max === Infinity ? `Use at least ${n(min)}.` : `Use ${n(min)} to ${n(max)}.`;
}

/** Why `value` can't stand for `path` next to the other `overrides`, or null when it can. */
export function paramError(path: string, value: number, overrides: ModelOverrides): string | null {
  const error = boundsError(path, value);
  const [key, end] = path.split('.');
  if (error || !end) return error;
  const at = (e: string) => (e === end ? value : (overrides[`${key}.${e}`] ?? defaultValue(`${key}.${e}`)));
  return at('lo') > at('hi') ? 'Keep low at or below high.' : null;
}

/** The overrides that are editable, valid and different from the defaults. */
export function cleanOverrides(raw: ModelOverrides): ModelOverrides {
  const inBounds: ModelOverrides = {};
  for (const path of EDITABLE_PATHS) if (raw[path] !== undefined && boundsError(path, raw[path]) === null) inBounds[path] = raw[path];
  const out: ModelOverrides = {};
  for (const [path, v] of Object.entries(inBounds)) if (v !== defaultValue(path) && paramError(path, v, inBounds) === null) out[path] = v;
  return out;
}
