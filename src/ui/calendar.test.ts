import { describe, expect, it } from 'vitest';
import { getSource } from '../sources/registry';
import { calendarItems } from './calendar';

describe('calendarItems', () => {
  it('lists bargaining, the Legislature and the levy expiry in date order', () => {
    expect(calendarItems(2027, 2029)).toEqual([
      { when: 'JAN 2027', text: 'Teacher bargaining opens', sourceKey: 'ui.bargaining' },
      { when: 'SPR 2027', text: 'Legislature sets the 2027-29 budget', sourceKey: 'model.stateFunding' },
      { when: 'JUN 2030', text: 'Levy expires', sourceKey: 'model.levyTerm' },
    ]);
  });

  it('rolls bargaining every 3 years and the Legislature every 2', () => {
    expect(calendarItems(2028, 2029).map((i) => i.when)).toEqual(['SPR 2029', 'JAN 2030', 'JUN 2030']);
  });

  it('says when the levy has expired', () => {
    expect(calendarItems(2031, 2029).find((i) => i.sourceKey === 'model.levyTerm')).toEqual({
      when: 'JUN 2030',
      text: 'Levy expired',
      sourceKey: 'model.levyTerm',
    });
  });

  it('sources every item', () => {
    for (const i of calendarItems(2027, 2029)) expect(getSource(i.sourceKey), i.sourceKey).toBeDefined();
    expect(getSource('ui.bargaining')!.tag).toBe('F');
  });
});
