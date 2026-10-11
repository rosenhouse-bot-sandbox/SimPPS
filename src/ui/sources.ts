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
  stateFunding: 'model.stateFunding',
  reserveDraw: 'ui.reserveDraw',
  autoCuts: 'model.autoCuts',
  midYearCuts: 'model.midYearCuts',
  enrollment: 'model.schoolRange',
  homerooms: 'model.homerooms',
  blended: 'model.homerooms',
  flows: 'model.movingRoll',
  ghost: 'model.ghost',
  bulletin: 'ui.bulletin',
  capacity: 'field.functional_capacity_model',
  distance: 'ui.distance',
  closureWalk: 'ui.closureWalk',
  closureOneTime: 'model.closureOneTime',
  closureSavings: 'model.closureSavings',
  closurePhasing: 'model.closurePhasing',
  paysOff: 'ui.paysOff',
  buildingFate: 'model.buildingFate',
  followRate: 'model.followRate',
  nonFollowers: 'model.nonFollowers',
  callIt: 'ui.callIt',
  share: 'ui.share',
  scenarios: 'model.scenarios',
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
  {
    key: K.distance,
    label: 'Distance',
    tag: 'I',
    explain: 'Straight-line miles between the two school sites, not a walking route.',
    links: [],
  },
  {
    key: K.closureWalk,
    label: 'Added walk',
    tag: 'M',
    explain: "The average change in straight-line miles from home for the closing school's kids, weighted by receiver share.",
    links: [],
  },
  {
    key: K.paysOff,
    label: 'Pays off if',
    tag: 'I',
    explain: 'The yearly saving at maturity over the revenue one kid brings, $7–13K by need. More leavers than this and lost revenue cancels the saving.',
    links: [],
  },
  {
    key: K.share,
    label: 'Shares',
    tag: 'M',
    explain: "Your split of the closing school's kids between receivers. A kid in a grade one receiver doesn't serve goes to the other.",
    links: [],
  },
  {
    key: K.callIt,
    label: 'Call it',
    tag: 'M',
    explain: "Your guess of how many of the school's kids stay in PPS. It hits when it lands in the modeled range.",
    links: [],
  },
];

registerSources(UI_SOURCES);
