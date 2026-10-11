import { SCENARIOS, type Start } from '../sim';

export function readUrl(search: string): { seed: string | null; start: Start | null } {
  const q = new URLSearchParams(search);
  const start = q.get('start');
  return { seed: q.get('seed'), start: start !== null && start in SCENARIOS ? (start as Start) : null };
}

export function writeUrl(search: string, seed: string, start: Start | null): string {
  const q = new URLSearchParams(search);
  q.set('seed', seed);
  if (start) q.set('start', start);
  else q.delete('start');
  return `?${q}`;
}
