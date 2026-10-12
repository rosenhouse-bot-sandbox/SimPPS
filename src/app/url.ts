import { SCENARIOS, type Start } from '../sim';
import type { ModelOverrides } from '../sim/types';
import { cleanOverrides } from '../sources/params';

/** Each model override is its own query parameter, e.g. "m.leaveRate=0.02". */
const MODEL_PREFIX = 'm.';

export function readUrl(search: string): { seed: string | null; start: Start | null } {
  const q = new URLSearchParams(search);
  const start = q.get('start');
  return { seed: q.get('seed'), start: start !== null && start in SCENARIOS ? (start as Start) : null };
}

export function readModel(search: string): ModelOverrides {
  const raw: ModelOverrides = {};
  for (const [k, v] of new URLSearchParams(search))
    if (k.startsWith(MODEL_PREFIX) && v.trim() !== '') raw[k.slice(MODEL_PREFIX.length)] = Number(v);
  return cleanOverrides(raw);
}

export function writeUrl(search: string, seed: string, start: Start | null, model: ModelOverrides = {}): string {
  const q = new URLSearchParams(search);
  q.set('seed', seed);
  if (start) q.set('start', start);
  else q.delete('start');
  for (const k of [...q.keys()]) if (k.startsWith(MODEL_PREFIX)) q.delete(k);
  for (const [path, v] of Object.entries(model)) q.set(MODEL_PREFIX + path, String(v));
  return `?${q}`;
}
