import { describe, expect, it } from 'vitest';
import { getSource } from './registry';
import { dialSourceKey, MODEL_SOURCES } from './model';
import type { Dials } from '../sim';
import { HIDDEN_CARDS } from '../sim/model';

const simFiles = import.meta.glob(['../sim/*.ts', '!../sim/*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('model sources', () => {
  it('registers every model key the simulation cites', () => {
    const keys = new Set<string>();
    for (const text of Object.values(simFiles)) for (const m of text.matchAll(/\bmodel\.(?!ts\b)[a-zA-Z0-9]+/g)) keys.add(m[0]);
    expect(keys.size).toBeGreaterThan(15);
    for (const key of keys) expect(getSource(key), key).toBeDefined();
  });

  it('explains and tags every source', () => {
    for (const s of MODEL_SOURCES) {
      expect(s.explain.length).toBeGreaterThan(20);
      expect(['F', 'N', 'I', 'M', 'V']).toContain(s.tag);
    }
  });

  it('hides the follow rate and closed-zone capture as cards', () => {
    expect(getSource('model.followRate')!.hidden!.outcomes.map((o) => o.value)).toEqual([0.95, 0.88, 0.8, 0.65]);
    expect(getSource('model.closedZoneCapture')!.hidden!.outcomes.map((o) => o.value)).toEqual([0, 0.02, 0.05]);
  });

  it('draws a card for every hidden source and hides every card', () => {
    const hidden = MODEL_SOURCES.filter((s) => s.hidden).map((s) => s.key);
    expect(hidden.sort()).toEqual(Object.values(HIDDEN_CARDS).sort());
  });

  it('gives every dial a source', () => {
    const dials: (keyof Dials)[] = ['kids', 'capture', 'kindergartenCapture', 'gap', 'positionsCut', 'reservePct', 'kidsInUrm', 'walkK5', 'newBusRiders', 'trust'];
    for (const d of dials) expect(getSource(dialSourceKey(d))).toBeDefined();
  });
});
