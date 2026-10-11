import { CLOSED_ZONE_CAPTURE_DROPS, FOLLOW_RATES, M } from '../sim/model';
import type { Dials } from '../sim/types';
import type { Source, SourceLink } from './types';

const PPS_DATA: SourceLink = { title: 'meub/pps-data', url: 'https://github.com/meub/pps-data' };
const PSU: SourceLink = {
  title: 'PSU Population Research Center school forecasts',
  url: 'https://www.pdx.edu/population-research/school-enrollment-forecasts',
};
const DESIGN: SourceLink = { title: 'SimPPS design (issue #1)', url: 'https://github.com/rosenhouse-bot-sandbox/SimPPS/issues/1' };

const $ = (n: number) => `$${(n / 1e6).toFixed(1)}M`;
const $k = (n: number) => `$${(n / 1e3).toFixed(1)}K`;
const pct = (x: number) => `${+(x * 100).toFixed(2)}%`;

export function dialSourceKey(dial: keyof Dials): string {
  return `dial.${dial}`;
}

export const MODEL_SOURCES: Source[] = [
  {
    key: 'model.households',
    label: 'Simulated households',
    tag: 'I',
    explain: `Each lit window is one simulated K-8 kid. Each school starts from its fall 2025 count, and the game plays fall 2026 before your first plan. About ${M.outsideKids.toLocaleString('en-US')} more resident kids attend private, charter or other schools. Homes sit at random points inside the real zones: ${pct(M.inZoneShare)} of a school's kids live in its zone (${pct(M.focusInZoneShare)} at focus schools), and the rest live anywhere in the city. Older grades are ${pct(M.gradeTilt)} larger per grade. No household has a name.`,
    links: [PPS_DATA, DESIGN],
  },
  {
    key: 'model.schoolRange',
    label: 'Simulated school counts',
    tag: 'M',
    explain: "A school's simulated counts add up simulated households' choices. One run is one roll of the dice, so the game shows the run's count plus or minus 5% and 2 more.",
    links: [DESIGN],
  },
  {
    key: 'model.altPrograms',
    label: 'Alternative programs',
    tag: 'I',
    explain: "The game simulates K-8 kids only. Alliance's 215 high schoolers and MLC's high schoolers (4 of its 13 grades) stay fixed. ACCESS serves grades 1-8; it starts from PSU's 2026 forecast of 315, because the state reports no count for it, and it takes no kindergartners.",
    links: [PPS_DATA, PSU],
  },
  {
    key: 'model.exitCapacity',
    label: 'Exit capacity',
    tag: 'M',
    explain: `The means to go private or move away. It falls as the zone school's direct-certification share rises, reaching zero at ${pct(M.directCertForZeroExit)}: Maplewood (8%) is high and Rosa Parks (63%) is low.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.loyalty',
    label: 'Loyalty',
    tag: 'M',
    explain: "The share of the zone's PPS K-5 kids who attend the zone school, with a little noise. Families for Equity in Schools reports about 38% of Creston-zone kids attend elsewhere.",
    links: [DESIGN],
  },
  {
    key: 'model.voice',
    label: 'Voice',
    tag: 'M',
    explain: 'The chance a household protests. It rises with exit capacity.',
    links: [DESIGN],
  },
  {
    key: 'model.kCapture',
    label: 'Kindergarten capture',
    tag: 'F',
    explain: `The share of resident kindergartners who enroll in PPS. It was 68% in 2020 and about ${pct(M.kCapture2025)} in 2025. PSU assumes ${pct(M.kCapture2028)} by 2028, and the game follows that trend. Each zone keeps its own starting share.`,
    links: [PSU],
  },
  {
    key: 'model.cohortTrend',
    label: 'Kindergarten cohorts',
    tag: 'M',
    explain: `Resident kindergarten cohorts shrink ${pct(-M.cohortTrend)} a year, fitted with the moving roll so status quo tracks the PSU forecast.`,
    links: [PSU],
  },
  {
    key: 'model.forecast',
    label: 'PSU forecast',
    tag: 'F',
    explain: 'PSU forecasts in-scope enrollment of 26,966 in 2025-26 falling to 23,999 in 2035-36, with a band of 22,119 to 26,412.',
    links: [PSU, PPS_DATA],
  },
  {
    key: 'model.movingRoll',
    label: 'Yearly moving roll',
    tag: 'M',
    explain: `Each year about ${pct(M.leaveRate)} of PPS kids leave, more where exit capacity is high. ${pct(M.awayShare)} of leavers move out of Portland; the rest stay as residents outside PPS. About ${pct(M.returnRate)} of resident kids outside PPS come back each year. The rates are fitted to the PSU forecast.`,
    links: [PSU],
  },
  {
    key: 'model.grade6',
    label: 'Grade 6 transition',
    tag: 'M',
    explain: `Kids leaving a K-5 school decide again: ${pct(M.grade6Exit)} leave PPS, ${pct(M.feederShare)} of the rest go to their zoned middle grades, and the others pick another middle school. ${pct(M.grade6Return)} of 6th graders outside PPS come back.`,
    links: [DESIGN],
  },
  {
    key: 'model.worseYear',
    label: 'A worse year',
    tag: 'M',
    explain: `Each kid of K-5 class size above 24 adds ${pct(M.classSizeExitPerKid)} to yearly exit, and each 100 positions cut adds ${pct(M.cutsExitPer100Positions)}. The total is capped at ${pct(M.worseYearCap)}. Below 24, kids stay a little more, up to half a point. No data exists, so the effect stays small.`,
    links: [DESIGN],
  },
  {
    key: 'model.graduates',
    label: 'Eighth graders',
    tag: 'M',
    explain: 'Eighth graders leave for high school. High schools stay outside the simulation.',
    links: [DESIGN],
  },
  {
    key: 'model.homerooms',
    label: 'Homerooms',
    tag: 'I',
    explain: `A school gets enough K-5 homerooms for its K-5 kids at ${M.overload} over the class size target, ${$k(M.homeroomCost)} each. Grades too small for their own rooms share blended classes. Grades 6-8 use classes of ${M.msClassSize}. This rule gives about 717 K-5 homerooms with about 125 blended, as PPS reported for 2025-26. The cost was fit to 10 points in PPS's Oct 6 deck.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.staffSteps',
    label: 'Other school staff',
    tag: 'F',
    explain: `Schools get 6, 7, 8 or 10 other positions as they grow past 300, 450 and 600 kids, at ${$k(M.positionCost)} each. The steps come from PPS's Oct 6 deck; the thresholds are ours.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.positionCost',
    label: 'Cost of a position',
    tag: 'I',
    explain: `About ${$k(M.positionCost)} a position, salary plus benefits. For scale, PPS closed its $56.3M gap for 2026-27 with 322 position cuts and other savings.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.plant',
    label: 'Buildings',
    tag: 'I',
    explain: `Plant costs $${M.plantPerSqft} per square foot a year, about $0.9M at a typical site. Square footage dates from 2009.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.costGrowth',
    label: 'Cost growth',
    tag: 'M',
    explain: `Costs rise ${pct(M.costGrowth)} a year. The design range is 3-4%.`,
    links: [DESIGN],
  },
  {
    key: 'model.revenuePerStudent',
    label: 'State revenue per student',
    tag: 'I',
    explain: `Each student brings ${$k(M.revenueBase)} to ${$k(M.revenueBase + M.revenuePoverty)} a year, weighted by the school's direct-certification share, on the prior year's count. Losing 1,000 students costs about $10-13M.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.stateFunding',
    label: 'State funding',
    tag: 'M',
    explain: 'The state holds funding flat at $11.36B for now. Later versions draw it as an outside card.',
    links: [DESIGN],
  },
  {
    key: 'model.levy',
    label: 'Local option levy',
    tag: 'F',
    explain: `At $${M.levyRate} per $1,000 the levy projects ${$(M.levyNet)} for 2026-27, about 686 teachers. Revenue scales with the rate, and compression grows faster than the rate, so a higher rate nets less than face value. At 0 the levy lapses and its revenue is gone.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.compression',
    label: 'Measure 5 compression',
    tag: 'F',
    explain: `Compression deletes ${$(M.compression)} of the levy at $${M.levyRate}. The game scales it with the rate to the power ${M.compressionPower} [M].`,
    links: [PPS_DATA],
  },
  {
    key: 'model.reserves',
    label: 'Reserves',
    tag: 'F',
    explain: `PPS holds ${$(M.reserves)} in reserves, 4.8% of an ${$(M.generalFund)} general fund. Below 5% breaches policy.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.gap2027',
    label: '2027-28 gap',
    tag: 'N',
    explain: `OPB and Willamette Week report a 2027-28 gap of ${$(-M.startGap)} at flat state funding. PPS has published no breakdown, so the game sizes the rest-of-district lines to reproduce it.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.restOfDistrict',
    label: 'Rest of district',
    tag: 'I',
    explain: `High schools, special education, transportation, central office and pensions are one lumped line each for revenue and cost. They are sized so the 2027-28 general fund is ${$(M.generalFund)} plus ${pct(M.costGrowth)} and the gap is ${$(-M.startGap)}. Rest-of-district costs grow ${pct(M.costGrowth)} a year; its revenue stays flat.`,
    links: [DESIGN],
  },
  {
    key: 'model.autoCuts',
    label: 'Automatic cuts',
    tag: 'M',
    explain: `Any shortfall left after the reserve draw becomes cuts by seniority at ${$k(M.positionCost)} a position. They spare IEP services and stay cut in later years. Homerooms take their share of the cuts by cost, so class sizes creep up at every school; other staff and central costs take the rest.`,
    links: [DESIGN],
  },
  {
    key: 'model.midYearCuts',
    label: 'Mid-year cuts',
    tag: 'M',
    explain: `When reserves after the draw fall below ${pct(M.midYearFloor)} of the year's spending, positions go mid-year until reserves reach it again. Each saves half a year of pay.`,
    links: [DESIGN],
  },
  {
    key: 'model.ghost',
    label: 'Do-nothing ghost',
    tag: 'M',
    explain: 'The ghost replays every year with the same luck, today\'s policy and automatic cuts.',
    links: [DESIGN],
  },
  {
    key: 'model.followRate',
    label: 'Follow a closed school',
    tag: 'M',
    explain: 'The share of a closed school\'s kids who follow it to a receiver. Anchors disagree: PPS says ">93% stayed"; Bridger fell from 752 to 446; Stanford found about 287 kids lost per closure. Each game draws one value, and each school varies ±5 points.',
    links: [DESIGN],
    hidden: {
      outcomes: FOLLOW_RATES.map((value) => ({ value, label: pct(value), weight: 1 })),
      revealAfterYears: 3,
    },
  },
  {
    key: 'model.closedZoneCapture',
    label: "Closed zone's kindergarten capture",
    tag: 'M',
    explain: "How far kindergarten capture falls in a closed school's zone. Each game draws one value.",
    links: [DESIGN],
    hidden: {
      outcomes: CLOSED_ZONE_CAPTURE_DROPS.map((value) => ({ value, label: `-${Math.round(value * 100)} points`, weight: 1 })),
      revealAfterYears: 3,
    },
  },
];

export const DIAL_SOURCES: Source[] = [
  { key: dialSourceKey('kids'), label: 'Kids', tag: 'M', explain: 'Simulated K-8 enrollment at the 74 in-scope schools. The game ages the fall 2025 count of 26,966 one year to fall 2026. PSU forecast 26,635 for fall 2026, and early counts run about 200 below.', links: [PPS_DATA] },
  { key: dialSourceKey('capture'), label: 'Capture', tag: 'M', explain: 'Simulated PPS K-8 kids over all resident K-8 kids. PPS reports 76.6% for K-12.', links: [DESIGN] },
  { key: dialSourceKey('kindergartenCapture'), label: 'Kindergarten capture', tag: 'M', explain: 'Simulated PPS kindergartners over resident kindergartners. It was about 74% in 2025.', links: [PSU] },
  { key: dialSourceKey('gap'), label: 'Gap', tag: 'M', explain: 'Revenue minus costs in the coming year\'s plan, before automatic cuts. It starts at the reported -$65.2M.', links: [DESIGN] },
  { key: dialSourceKey('positionsCut'), label: 'Positions cut', tag: 'M', explain: 'Positions removed by automatic and mid-year cuts in the year just played.', links: [DESIGN] },
  { key: dialSourceKey('reservePct'), label: 'Reserves', tag: 'M', explain: 'Reserves over last year\'s spending. They start at $41.1M, 4.8% of the $862.1M 2026-27 general fund. Below 5% breaches policy; below 3% forces mid-year cuts.', links: [PPS_DATA] },
  { key: dialSourceKey('kidsInUrm'), label: 'Kids in URM buildings', tag: 'M', explain: 'Simulated kids in the 18 unreinforced-masonry buildings (Holmes 2024).', links: [PPS_DATA] },
];
