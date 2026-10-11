import { describe, expect, it } from 'vitest';
import { fixtureSchools } from '../map/fixtures';
import type { Closure } from '../sim/types';
import { canClose, receiverCandidates, startDraft, toClosure, toggleReceiver, type CloseDraft } from './closeSend';

const schools = fixtureSchools();

describe('receiverCandidates', () => {
  it('lists open schools nearest first, with miles and seats', () => {
    const c = receiverCandidates(schools, 'peninsula', []);
    expect(c[0]).toMatchObject({ id: 'rosa-parks', name: 'Rosa Parks', kids: 160, capacity: 594 });
    expect(c[0].miles).toBeCloseTo(0.73, 1);
    for (let i = 1; i < c.length; i++) expect(c[i].miles).toBeGreaterThanOrEqual(c[i - 1].miles);
    expect(c.some((x) => x.id === 'peninsula')).toBe(false);
  });

  it('leaves out closed schools, schools closing in the plan and schools serving none of its grades', () => {
    const closed = { ...schools, 'rosa-parks': { ...schools['rosa-parks'], open: false } };
    const plan: Closure[] = [{ school: 'james-john', receivers: [{ school: 'sitton', share: 1 }], building: 'mothball' }];
    const ids = receiverCandidates(closed, 'peninsula', plan).map((c) => c.id);
    expect(ids).not.toContain('rosa-parks');
    expect(ids).not.toContain('james-john');
    expect(receiverCandidates(schools, 'sellwood', []).map((c) => c.id)).not.toContain('duniway');
    expect(receiverCandidates(schools, 'sellwood', []).map((c) => c.id)).toContain('lane');
  });
});

describe('canClose', () => {
  it('needs an open school with K-8 kids', () => {
    expect(canClose(schools['peninsula'])).toBe(true);
    expect(canClose({ ...schools['peninsula'], open: false })).toBe(false);
    expect(canClose({ ...schools['peninsula'], enrollment: 0 })).toBe(false);
    expect(canClose(undefined)).toBe(false);
  });
});

describe('the draft', () => {
  it('takes up to two receivers, swapping the second, and resets shares to 100 or 70/30', () => {
    let d: CloseDraft = startDraft('maplewood');
    expect(d).toEqual({ school: 'maplewood', step: 1, receivers: [], firstShare: 100, building: 'mothball' });
    d = toggleReceiver(d, 'hayhurst');
    expect(d.firstShare).toBe(100);
    d = toggleReceiver(d, 'rieke');
    expect(d.receivers).toEqual(['hayhurst', 'rieke']);
    expect(d.firstShare).toBe(70);
    d = toggleReceiver(d, 'markham');
    expect(d.receivers).toEqual(['hayhurst', 'markham']);
    d = toggleReceiver(d, 'hayhurst');
    expect(d.receivers).toEqual(['markham']);
    expect(d.firstShare).toBe(100);
  });

  it('turns into a closure, and resumes from one', () => {
    const d: CloseDraft = { school: 'maplewood', step: 3, receivers: ['hayhurst', 'rieke'], firstShare: 60, building: 'sell' };
    const c = toClosure(d, 120);
    expect(c).toEqual({
      school: 'maplewood',
      receivers: [
        { school: 'hayhurst', share: 0.6 },
        { school: 'rieke', share: 0.4 },
      ],
      building: 'sell',
      guess: 120,
    });
    expect(startDraft('maplewood', c)).toEqual({ ...d, step: 1 });
    expect(toClosure({ ...d, receivers: ['hayhurst'], firstShare: 100 }).receivers).toEqual([{ school: 'hayhurst', share: 1 }]);
  });
});
