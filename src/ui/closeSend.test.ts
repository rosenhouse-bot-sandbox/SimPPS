import { describe, expect, it } from 'vitest';
import { startDraft, toClosure, toggleReceiver, withNames, type CloseDraft } from './closeSend';

describe('withNames', () => {
  it('names each candidate', () => {
    expect(withNames([{ id: 'rosa-parks', miles: 0.7, kids: 160, capacity: 594 }])).toEqual([
      { id: 'rosa-parks', name: 'Rosa Parks', miles: 0.7, kids: 160, capacity: 594 },
    ]);
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
    expect(startDraft('maplewood', c)).toEqual({ ...d, step: 1, guess: 120 });
    expect(toClosure(startDraft('maplewood', c))).toEqual(c);
    expect(toClosure({ ...d, receivers: ['hayhurst'], firstShare: 100 }).receivers).toEqual([{ school: 'hayhurst', share: 1 }]);
  });
});
