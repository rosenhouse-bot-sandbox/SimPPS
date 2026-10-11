import { dialSourceKey } from '../sources/model';
import { registerSources, type Source } from '../sources/registry';

/** Keys the shell shows. Keys outside "ui." belong to the sim. */
export const K = {
  calendar: 'ui.calendar',
  gap: dialSourceKey('gap'),
  reservePct: dialSourceKey('reservePct'),
  kids: dialSourceKey('kids'),
  capture: dialSourceKey('capture'),
  classSize: 'ui.k5ClassSize',
  levy: 'model.levy',
  reserveDraw: 'ui.reserveDraw',
  autoCuts: 'model.autoCuts',
  midYearCuts: 'model.midYearCuts',
  enrollment: 'model.schoolRange',
  homerooms: 'model.homerooms',
  blended: 'model.homerooms',
  flows: 'model.movingRoll',
  ghost: 'model.ghost',
  bulletin: 'ui.bulletin',
} as const;

const UI_SOURCES: Source[] = [
  {
    key: K.calendar,
    label: 'Calendar',
    tag: 'F',
    explain: 'A turn follows PPS’s year: plan in January, budget in June, classes form in October.',
    links: [],
  },
  {
    key: K.classSize,
    label: 'K-5 class size',
    tag: 'I',
    explain: 'The target is 24 today. Each step of one cuts or adds about 4% of homerooms, $3–5M a year.',
    links: [],
  },
  {
    key: K.reserveDraw,
    label: 'Reserve draw',
    tag: 'F',
    explain: 'Dollars spent from reserves this year. A draw helps once.',
    links: [],
  },
  {
    key: K.bulletin,
    label: 'The Bulletin',
    tag: 'M',
    explain: 'Headlines written from simulated totals. They never describe real families.',
    links: [],
  },
];

registerSources(UI_SOURCES);
