import { FIRST_YEAR } from '../sim';
import { K } from './sources';

export interface CalendarItem {
  when: string;
  text: string;
  sourceKey: string;
}

/** The teacher contract runs 3 years; bargaining opens January 2027. */
const CONTRACT_YEARS = 3;

/** Coming dates as of January `year`, soonest first. */
export function calendarItems(year: number, levyThrough: number): CalendarItem[] {
  const bargaining = year + ((((FIRST_YEAR - year) % CONTRACT_YEARS) + CONTRACT_YEARS) % CONTRACT_YEARS);
  const legislature = year + ((year - FIRST_YEAR) % 2);
  const items: [number, CalendarItem][] = [
    [bargaining * 12, { when: `JAN ${bargaining}`, text: 'Teacher bargaining opens', sourceKey: K.bargaining }],
    [
      legislature * 12 + 4,
      {
        when: `SPR ${legislature}`,
        text: `Legislature sets the ${legislature}-${String(legislature + 2).slice(2)} budget`,
        sourceKey: K.stateFunding,
      },
    ],
    [
      (levyThrough + 1) * 12 + 6,
      { when: `JUN ${levyThrough + 1}`, text: levyThrough < year ? 'Levy expired' : 'Levy expires', sourceKey: K.levyTerm },
    ],
  ];
  return items.sort((a, b) => a[0] - b[0]).map(([, i]) => i);
}
