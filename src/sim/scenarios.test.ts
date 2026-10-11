import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, newGame, normalizePolicy } from '.';
import { SCENARIOS } from './scenarios';

describe('scenario starts', () => {
  const quo = newGame({ seed: 's' });
  const a = newGame({ seed: 's', start: 'scenario-a' });
  const b = newGame({ seed: 's', start: 'scenario-b' });

  it('loads PPS Scenario A as 14 editable closures and B as 11', () => {
    expect(quo.policy).toEqual(DEFAULT_POLICY);
    expect(a.policy.closures).toHaveLength(14);
    expect(b.policy.closures).toHaveLength(11);
    expect(normalizePolicy(a.policy)).toEqual(a.policy);
    const bSchools = b.policy.closures.map((c) => c.school);
    expect(a.policy.closures.map((c) => c.school).filter((s) => !bSchools.includes(s)).sort()).toEqual([
      'lewis',
      'rose-city-park',
      'stephenson',
    ]);
  });

  it('sends kids to the receivers PPS published', () => {
    const to = (id: string) => a.policy.closures.find((c) => c.school === id)!.receivers;
    expect(to('peninsula')).toEqual([{ school: 'rosa-parks', share: 1 }]);
    expect(to('maplewood')).toEqual([
      { school: 'hayhurst', share: 0.7 },
      { school: 'rieke', share: 0.3 },
    ]);
    expect(to('buckman').map((r) => r.share)).toEqual([0.5, 0.5]);
  });

  it('starts from the same families and books as status quo', () => {
    expect(a.households).toEqual(quo.households);
    expect(a.schools).toEqual(quo.schools);
    expect(a.sim).toEqual(quo.sim);
  });

  it('names what the scenario changes that the game does not model yet', () => {
    expect(SCENARIOS['status-quo'].notModeled).toBeNull();
    expect(SCENARIOS['scenario-a'].notModeled).toBe(
      'Not modeled yet: 8 grade-span changes, 13 program moves and 38 boundary changes.',
    );
    expect(SCENARIOS['scenario-b'].notModeled).toBe(
      'Not modeled yet: 8 grade-span changes, 12 program moves and 34 boundary changes.',
    );
  });
});
