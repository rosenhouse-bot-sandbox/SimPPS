import { fmtMoney } from '../format';
import { M } from '../sim/model';
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
  levyRate: 'model.levyRate',
  levyTerm: 'model.levyTerm',
  election: 'model.election',
  electionBill: 'model.electionBill',
  bargaining: 'ui.bargaining',
  trust: dialSourceKey('trust'),
  stateFunding: 'model.stateFunding',
  reserveDraw: 'ui.reserveDraw',
  autoCuts: 'model.autoCuts',
  midYearCuts: 'model.midYearCuts',
  enrollment: 'model.schoolRange',
  homerooms: 'model.homerooms',
  blended: 'model.homerooms',
  flows: 'model.movingRoll',
  kCapture: 'model.kCapture',
  graduates: 'model.graduates',
  ghost: 'model.ghost',
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
  zoneGrid: 'model.zoneGrid',
  households: 'model.households',
  sliceStay: 'model.sliceStay',
  gradeSpan: 'model.gradeSpan',
  programMove: 'model.programMove',
  dli: 'model.dli',
  walkLimit: 'model.walkLimit',
  busing: 'model.busing',
  busReimbursement: 'model.busReimbursement',
  walkK5: dialSourceKey('walkK5'),
  newBusRiders: dialSourceKey('newBusRiders'),
} as const;

const UI_SOURCES: Source[] = [
  {
    key: K.bargaining,
    label: 'Teacher bargaining',
    tag: 'N',
    explain: 'PPS and the Portland Association of Teachers agreed a one-year contract in May 2026, so bargaining opens again in January 2027. After that the game assumes 3-year contracts [M]. Strikes are not modeled yet.',
    links: [
      { title: 'KPTV, May 27 2026', url: 'https://www.kptv.com/2026/05/27/pps-teachers-union-agree-1-year-collective-bargaining-agreement/' },
      { title: 'SimPPS design (issue #1)', url: 'https://github.com/rosenhouse-bot-sandbox/SimPPS/issues/1' },
    ],
  },
  {
    key: K.calendar,
    label: 'Calendar',
    tag: 'I',
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
    tag: 'M',
    explain: 'Your choice of dollars to spend from reserves this year. A draw helps once.',
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
    get explain() {
      const k = (n: number) => fmtMoney(n);
      return `The yearly saving at maturity over the revenue one kid brings, ${k(M.revenueBase)}–${k(M.revenueBase + M.revenuePoverty)} by need. More leavers than this and lost revenue cancels the saving.`;
    },
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
