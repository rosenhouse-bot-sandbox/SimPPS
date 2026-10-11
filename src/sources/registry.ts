import { FIELD_SOURCES } from '../data';
import { DIAL_SOURCES, MODEL_SOURCES, PPS_DATA } from './model';
import type { Source } from './types';

export * from './types';

/** Per-school facts from pps-data use the key "field.<column>", e.g. "field.enrollment_2025_26". */
const FIELD: Source[] = Object.entries(FIELD_SOURCES).map(([column, f]) => ({
  key: `field.${column}`,
  label: f.label,
  tag: 'F',
  explain: `${f.desc} Source: ${f.source}.`,
  links: [PPS_DATA],
}));

const REGISTRY = new Map([...MODEL_SOURCES, ...DIAL_SOURCES, ...FIELD].map((s) => [s.key, s]));

export function getSource(key: string): Source | undefined {
  return REGISTRY.get(key);
}

export function registerSources(sources: Source[]): void {
  for (const s of sources) REGISTRY.set(s.key, s);
}
