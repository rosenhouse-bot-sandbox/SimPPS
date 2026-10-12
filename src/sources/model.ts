import { MEDIAN_SQFT, STATE_PER_STUDENT } from '../sim/budget';
import { CLOSED_ZONE_CAPTURE_DROPS, FOLLOW_RATES, M, REVEAL_AFTER_YEARS } from '../sim/model';
import { CITYWIDE_INTAKE } from '../sim/population';
import { CELL_METERS } from '../sim/grid';
import rightsizing from '../data/rightsizing.json';
import type { Dials } from '../sim/types';
import type { Source, SourceLink } from './types';

export const PPS_DATA: SourceLink = { title: 'meub/pps-data', url: 'https://github.com/meub/pps-data' };
const PSU: SourceLink = {
  title: 'PSU Population Research Center school forecasts',
  url: 'https://www.pdx.edu/population-research/school-enrollment-forecasts',
};
const OPB_GAP: SourceLink = {
  title: 'OPB, Oct 5 2026',
  url: 'https://www.opb.org/article/2026/10/05/portland-public-schools-closures-rightsizing/',
};
const WW_GAP: SourceLink = {
  title: 'Willamette Week, Apr 28 2026',
  url: 'https://www.wweek.com/news/schools/2026/04/28/portland-public-schools-faces-56-million-budget-deficit-as-superintendent-proposes-336-layoffs/',
};
const RIGHTSIZING: SourceLink = { title: `PPS, ${rightsizing.source.title}`, url: rightsizing.source.url };
const LEVY_2019: SourceLink = { title: 'Multnomah County, Measure 26-207, Nov 2019', url: 'https://multco.us/elections/measure-26-207-november-2019-special-election' };
const LEVY_2024: SourceLink = {
  title: 'PPS, proposed 2024 levy renewal',
  url: 'https://www.pps.net/about/portland-public-schools-information/proposed-2024-local-option-levy-renewal',
};
const LEVY_2024_COUNTY: SourceLink = {
  title: 'Multnomah County, Measure 26-246, May 2024',
  url: 'https://multco.us/info/measure-26-246-levy-renewal-maintain-teachers-and-classroom-support-staff',
};
const STANFORD: SourceLink = {
  title: 'Pearman, The Fiscal Consequences of School Closures in California (2026)',
  url: 'https://www.gettingdowntofacts.com/sites/default/files/The%20Fiscal%20Consequences%20of%20School%20Closures%20in%20CA%20Evidence%20from%20a%20Statewide%20Synthetic%20Difference-in-Differences%20Design.pdf',
};
const EDWEEK: SourceLink = {
  title: 'EdWeek, Jun 2026',
  url: 'https://www.edweek.org/leadership/closing-a-school-dont-expect-to-save-money-a-new-study-warns/2026/06',
};
const DESIGN: SourceLink = { title: 'SimPPS design (issue #1)', url: 'https://github.com/rosenhouse-bot-sandbox/SimPPS/issues/1' };

const $ = (n: number) => `$${(n / 1e6).toFixed(1)}M`;
const $b = (n: number) => `$${(n / 1e9).toFixed(2)}B`;
const $k = (n: number) => `$${(n / 1e3).toFixed(1)}K`;
const pct = (x: number) => `${+(x * 100).toFixed(2)}%`;
const pts = (x: number) => `${+(x * 100).toFixed(2)}`;

const ACCESS_INTAKE = CITYWIDE_INTAKE.find((p) => p.school === 'access-academy')!.kids;

export function dialSourceKey(dial: keyof Dials): string {
  return `dial.${dial}`;
}

const TRUST = `Each high school region's families start at ${M.trustStart.lo}-${M.trustStart.hi} on a 0-100 scale. A closure costs ${M.trustClosure} points, split among regions by where its kids live. A region where a kid moves a second time loses ${M.trustMovedTwice}. A region with no forced moves gains ${M.trustCalmYear} a year. Each year, every region loses ${M.trustPer100PositionsCut} per 100 positions cut that year. Raising the K-5 class size above 24 costs ${M.trustPerKidOver24} per kid once, and lowering it earns that back. Each kid above 24 also takes ${M.trustPerKidOver24} from the calm-year gain. The Trust dial averages regions over simulated households. Trust moves levy votes.`;

export const MODEL_SOURCES: Source[] = [
  {
    key: 'model.generalFund',
    label: 'General fund',
    tag: 'F',
    explain: `PPS adopted a general fund of ${$(M.generalFund)} for 2026-27.`,
    links: [PPS_DATA],
  },
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
    explain: `The game simulates K-8 kids only. Alliance's 215 high schoolers and MLC's high schoolers (4 of its 13 grades) stay fixed. ACCESS serves grades 1-8; it starts from PSU's 2026 forecast of 315, because the state reports no count for it. It has no zone, so each fall it takes ${ACCESS_INTAKE} first graders from other PPS schools across the city, enough to hold its size.`,
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
    tag: 'I',
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
    tag: 'I',
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
    explain: `Plant costs $${M.plantPerSqft.toFixed(2)} per square foot a year, ${$(MEDIAN_SQFT * M.plantPerSqft)} at the median site, to match PPS's figure of about $0.9M a site. Square footage dates from 2009.`,
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
    explain: `Each student brings ${$k(M.revenueBase)} to ${$k(M.revenueBase + M.revenuePoverty)} a year, weighted by the school's direct-certification share, on the prior year's count. Kids a closure moves, and kindergartners from a closed zone, keep the closed school's weight. At today's mix, 1,000 fewer students cost about ${$(1000 * STATE_PER_STUDENT)} of state revenue. PPS puts the loss at $10-13M, because it also counts revenue that the game holds fixed.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.stateFunding',
    label: 'State funding',
    tag: 'M',
    explain: `Each odd spring the Legislature sets state school funding for 2 years. It is ${$b(M.stateFunding2025)} for 2025-27, and ODE puts the 2027-29 current service level at ${$b(M.stateFundingCeiling)} [F]. Each biennium the game draws growth from flat to ${pct(M.stateFundingCeiling / M.stateFunding2025 - 1)}, with the same draw for you and the ghost. The growth applies to state revenue per student for K-8 and for the ${M.otherStudents.toLocaleString('en-US')} other students [I]. A January plan in an odd year assumes flat, as PPS does.`,
    links: [DESIGN],
  },
  {
    key: 'model.levy',
    label: 'Local option levy',
    tag: 'F',
    explain: `At $${M.levyRate} per $1,000 of assessed value the levy projects ${$(M.levyNet)} for 2026-27, about 686 teachers.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.levyRate',
    label: 'Levy at a new rate',
    tag: 'M',
    explain: `The game prices other rates with its compression model: gross revenue scales with the rate, and Measure 5 compression of ${$(M.compression)} at $${M.levyRate} scales with the rate to the power ${M.compressionPower}. At 0 the levy lapses and its revenue is gone. A new rate assumes the vote passes. Now includes the ${$(M.electionBill)} election bill; a November vote changes revenue from next fall.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.levyTerm',
    label: 'Levy term',
    tag: 'F',
    explain: `Oregon limits an operating levy to ${M.levyYears} years. Voters renewed PPS's levy at $${M.levyRate} in May 2024 (Measure 26-246) for 2025-26 through 2029-30, so the game ends it in June ${M.levyThrough + 1}. A renewal can go on the November ballot before the last year or the May ballot after it. A rate change also needs a vote; a lapse needs none [M].`,
    links: [LEVY_2024_COUNTY, LEVY_2024],
  },
  {
    key: 'model.election',
    label: 'Levy election',
    tag: 'V',
    explain: `The yes share starts at ${pct(M.yesBase)}, the election-night count for PPS's May 2024 renewal; the certified share is unverified. The Nov 2019 renewal drew 77% [F]. Each point of family trust above or below 35 moves it ${pts(M.yesPerTrustPoint)} points, each $0.10 above $${M.levyRate} costs ${pts(M.yesPerDime)} and each failure since the last pass costs ${pts(M.yesPerFailure)} [M]. The vote lands within ${pts(M.yesNoise)} points of that, with the same luck for the ghost. The poll shows ±${pts(M.pollSpread)} points; a November poll counts trust after this year's closures, class size change and planned June cuts. The poll reads your January plan, which can't see June state funding. Mid-year cuts come after a November vote. A measure passes when yes votes outnumber no votes, so a raise after closures that cost trust can fail. Abandoned upgrades are not modeled yet.`,
    links: [LEVY_2019, LEVY_2024_COUNTY, DESIGN],
  },
  {
    key: 'model.electionBill',
    label: 'Election bill',
    tag: 'V',
    explain: `The county bills the district for each measure. The game books ${$(M.electionBill)}, an unverified guess.`,
    links: [DESIGN],
  },
  {
    key: 'model.trust',
    label: 'Family trust',
    tag: 'M',
    explain: TRUST,
    links: [DESIGN],
  },
  {
    key: 'model.compression',
    label: 'Measure 5 compression',
    tag: 'M',
    explain: `Compression deletes ${$(M.compression)} of the levy at $${M.levyRate}, PPS's figure. The game scales gross levy revenue with the rate and compression with the rate to the power ${M.compressionPower}, so a higher rate nets less than face value.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.reserves',
    label: 'Reserves',
    tag: 'I',
    explain: `PPS holds ${$(M.reserves)} in reserves. Divided by the ${$(M.generalFund)} general fund, that is 4.8%; PPS calls it its ${pct(M.reservePolicy)} floor [V]. Below ${pct(M.reservePolicy)} breaches policy [V].`,
    links: [PPS_DATA],
  },
  {
    key: 'model.gap2027',
    label: '2027-28 gap',
    tag: 'N',
    explain: `OPB and Willamette Week report a 2027-28 gap of ${$(-M.startGap)} at flat state funding. PPS has published no breakdown, so the game back-solves the rest-of-district lines to reproduce it [I].`,
    links: [OPB_GAP, WW_GAP],
  },
  {
    key: 'model.restOfDistrict',
    label: 'Rest of district',
    tag: 'I',
    explain: `High schools, special education, transportation, central office and pensions are one lumped line each for revenue and cost. They are sized so the 2027-28 general fund is ${$(M.generalFund)} plus ${pct(M.costGrowth)} and the gap is ${$(-M.startGap)}. Rest-of-district costs grow ${pct(M.costGrowth)} a year. Its revenue stays flat except for the state funding card.`,
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
    explain: 'The share of a closed school\'s kids who follow it to a receiver. Anchors disagree: PPS says ">93% stayed" after past consolidations, with no published method [F]; Bridger\'s combined enrollment fell from 752 to 446 after its merger [N]; a Stanford study of California found about 287 students lost per closure [F]. Each game draws one value, and each school varies ±5 points. Most adjustments under "Who follows a closed school" lower a kid\'s chance, so fewer kids follow than the card says, and even the 95% card keeps fewer kids in PPS than PPS reports.',
    links: [RIGHTSIZING, STANFORD, EDWEEK, DESIGN],
    hidden: {
      outcomes: FOLLOW_RATES.map((value) => ({ value, label: pct(value), weight: 1 })),
      revealAfterYears: REVEAL_AFTER_YEARS,
    },
  },
  {
    key: 'model.closedZoneCapture',
    label: "Closed zone's kindergarten capture",
    tag: 'M',
    explain: "How far kindergarten capture falls in a closed school's zone. No study measures it, so the card spans no drop to 5 points. Each game draws one value.",
    links: [DESIGN],
    hidden: {
      outcomes: CLOSED_ZONE_CAPTURE_DROPS.map((value) => ({ value, label: value === 0 ? 'No drop' : `−${Math.round(value * 100)} points`, weight: 1 })),
      revealAfterYears: REVEAL_AFTER_YEARS,
    },
  },
  {
    key: 'model.closureSavings',
    label: 'Closure savings',
    tag: 'I',
    explain: `A closed building's plant cost and its principal's office (${M.principalOffice} positions) go. Its other staff follow the kids and fill the staff steps the receivers need; any left over stay on the payroll. Receivers add the homerooms the kids need. The project's closure analysis estimates $0.3-1.5M a school, and PPS estimates $5-20M for its scenarios. This arithmetic puts Scenario A's closures at $0.7-1.7M each and about $17M in all. The chip shows the saving if every kid follows, ±${pct(M.closureSavingsSpread)}, net of building upkeep and of busing for new riders after the state's repayment.`,
    links: [DESIGN],
  },
  {
    key: 'model.closurePhasing',
    label: 'Closure phasing',
    tag: 'I',
    explain: `A closure saves ${M.closurePhasing.map(pct).join(', then ')} of its yearly saving in its first three years. Staff and costs take time to move.`,
    links: [DESIGN],
  },
  {
    key: 'model.closureOneTime',
    label: 'Closure, once',
    tag: 'M',
    explain: `Moving a school costs ${$(M.closureOneTime.lo)}-${$(M.closureOneTime.hi)} once, in the year played. The budget books the middle. The chip's Now adds a year of busing for new riders.`,
    links: [DESIGN],
  },
  {
    key: 'model.buildingFate',
    label: 'Closed building',
    tag: 'I',
    explain: `An empty, mothballed building costs about ${$k(M.mothball)} a year, as the closed Smith building does [V]. A leased building's tenant pays its upkeep; the game assumes a tenant is found at once and ignores lease terms that limit reopening [M]. A sold building costs nothing and can't reopen; sale money goes to capital, not the general fund [I].`,
    links: [DESIGN],
  },
  {
    key: 'model.followAdjustments',
    label: 'Who follows a closed school',
    tag: 'M',
    explain: `Each kid's chance to follow starts at the hidden follow rate. It falls ${pts(M.followPerMilePastOne)} points a mile past the first, ${pts(M.followBarrier)} across the Willamette, ${pts(M.followRiskier)} into an unretrofitted URM building, ${pts(M.followMovedTwice)} for a kid moved before, up to ${pts(M.followLoyal)} for loyalty and up to ${pts(M.followExit)} for exit capacity. It rises ${pts(M.followWholeClasses)} when one receiver takes whole classes. Freeways and arterials are not modeled yet.`,
    links: [DESIGN],
  },
  {
    key: 'model.nonFollowers',
    label: "Kids who don't follow",
    tag: 'M',
    explain: `${pct(M.nonFollowerOtherPps)} go to the nearest other PPS school with room, ${pct(M.nonFollowerCharter)} to a charter and the rest leave PPS. Their closed zone sends future kindergartners to the receivers.`,
    links: [DESIGN],
  },
  {
    key: 'model.crowding',
    label: 'Crowded schools',
    tag: 'M',
    explain: `A receiver or new zone school past ${pct(M.crowdingLine)} of its seats sends the arrivals beyond that line on to the nearest PPS school with room.`,
    links: [DESIGN],
  },
  {
    key: 'model.zoneGrid',
    label: 'Zone blocks',
    tag: 'I',
    explain: `The game draws zones on ${CELL_METERS} m grid squares clipped to the real 53 K-5 zone polygons [F]. A block here is about 4 by 4 city blocks. Each block has a K-5 zone school and a middle zone school, the one at most of its points, and every home on it takes both. Boundary edits and closures move blocks between zones.`,
    links: [PPS_DATA],
  },
  {
    key: 'model.sliceStay',
    label: 'Re-zoned kids',
    tag: 'M',
    explain: `A kid whose zone school changes under it goes to the new zone school with a ${pct(M.sliceStay)} chance, less the adjustments under "Who follows a closed school" except whole classes. The rest choose like a closed school's kids who don't follow. A grandfathered edit moves no current student: only new kindergartners and 6th graders, and kids outside PPS, use the new zone.`,
    links: [DESIGN],
  },
  {
    key: 'model.gradeSpan',
    label: 'K-8 to K-5',
    tag: 'M',
    explain: `A K-8 that sends grades 6–8 to a middle school serves K-5 from that fall. Its rising 7th and 8th graders go to the middle school with a ${pct(M.conversionStay)} chance, less the adjustments under "Who follows a closed school". The rest choose like a closed school's kids who don't follow. Its rising 6th graders, and every class after them, face the grade-6 transition. Its middle zone feeds the middle school. Its rooms seat K-5 classes, so it keeps about ${Math.round(M.conversionCapacity * 100)}% of its seats.`,
    links: [DESIGN, RIGHTSIZING],
  },
  {
    key: 'model.programMove',
    label: 'DLI program moves',
    tag: 'M',
    explain: `A moved Dual Language Immersion program serves its new school from that fall. Each of its kids still in their old school's grades follows it with a ${pct(M.programMoveStay)} chance, ${M.followPerMilePastOne * 100} points less for each mile past 2 from home. Families chose DLI by lottery, so most should keep it when it moves [I]; a closed school's follow rate is lower. Arrivals aren't capped by the receiver's seats. The rest stay at their old school without the program, or choose like its other kids if it closes or changes grades. New DLI kindergartners who would have picked the old school go to the new one.`,
    links: [DESIGN, RIGHTSIZING],
  },
  {
    key: 'model.dli',
    label: 'DLI kids',
    tag: 'I',
    explain: "Each school starts with PPS's October 2025 count of DLI kids, or all its kids when fewer, picked at random. A school with two languages splits its count evenly. Each year, a kindergartner who picks a DLI school joins its program with the school's 2025-26 DLI share. A kid keeps the program only at a school that offers it, so DLI kids who reach a middle school without their language leave it.",
    links: [PPS_DATA],
  },
  {
    key: 'model.walkLimit',
    label: 'Walk limit',
    tag: 'V',
    explain: `K-5 kids who live more than ${M.walkLimitK5} mile from school ride a bus, and grades 6-8 past ${M.walkLimitMiddle} miles. Distances are straight lines, so real walks are longer.`,
    links: [DESIGN],
  },
  {
    key: 'model.busing',
    label: 'New bus riders',
    tag: 'V',
    explain: `A new rider costs $${M.busRider.lo.toLocaleString('en-US')}-${M.busRider.hi.toLocaleString('en-US')} a year. A new rider is a kid at its zone school past the walk limit whose zone before any change was within it. The budget books the middle for the kids expected to ride next fall if every kid stays in PPS, counting kindergartners like this year's at the same homes and expected returners. A chip's At maturity counts every re-zoned kid riding, less the state's ${pct(M.busReimbursed.lo)}-${pct(M.busReimbursed.hi)} repayment. Kids whose new zone is closer save nothing here. General-fund transportation is $47.6M [F].`,
    links: [DESIGN],
  },
  {
    key: 'model.busReimbursement',
    label: "State's busing repayment",
    tag: 'V',
    explain: `The state repays ${pct(M.busReimbursed.lo)}-${pct(M.busReimbursed.hi)} of approved busing a year later. The budget books the middle of last year's new-rider busing.`,
    links: [DESIGN],
  },
  {
    key: 'model.scenarios',
    label: 'PPS scenarios',
    tag: 'F',
    explain: "Scenario A closes 14 schools and Scenario B 11, with PPS's receivers and shares. Sellwood MS's split is unpublished, so the game splits it evenly [I]. Each building is mothballed until you change it [M]. DLI program moves and K-8 grade-span changes follow PPS's lists; a program move that names no language moves its school's only one [I]. The Deaf and Hard of Hearing and Odyssey moves have no student counts, and PPS's boundary changes are not modeled yet.",
    links: [RIGHTSIZING],
  },
];

export const DIAL_SOURCES: Source[] = [
  { key: dialSourceKey('kids'), label: 'Kids', tag: 'M', explain: 'Simulated K-8 enrollment at the 74 in-scope schools. The game ages the fall 2025 count of 26,966 one year to fall 2026. PSU forecast 26,635 for fall 2026, and early counts run about 200 below.', links: [PPS_DATA] },
  { key: dialSourceKey('capture'), label: 'Capture', tag: 'M', explain: 'Simulated PPS K-8 kids over all resident K-8 kids. PPS reports 76.6% for K-12.', links: [DESIGN] },
  { key: dialSourceKey('kindergartenCapture'), label: 'Kindergarten capture', tag: 'M', explain: 'Simulated PPS kindergartners over resident kindergartners. It was about 74% in 2025.', links: [PSU] },
  { key: dialSourceKey('gap'), label: 'Gap', tag: 'M', explain: 'Revenue minus costs in the coming year\'s plan, before automatic cuts. It starts at the reported -$65.2M. A surplus goes to reserves; cut positions are not rehired yet.', links: [DESIGN] },
  { key: dialSourceKey('positionsCut'), label: 'Positions cut', tag: 'M', explain: 'Positions removed by automatic and mid-year cuts in the year just played.', links: [DESIGN] },
  { key: dialSourceKey('reservePct'), label: 'Reserves', tag: 'M', explain: `Reserves over last year's spending. They start at $41.1M, 4.8% of the $862.1M 2026-27 general fund. Below ${pct(M.reservePolicy)} breaches policy [V]; below ${pct(M.midYearFloor)} forces mid-year cuts.`, links: [PPS_DATA] },
  { key: dialSourceKey('walkK5'), label: 'K-5 walkers', tag: 'M', explain: `Simulated PPS K-5 kids within ${M.walkDialMiles} mile of their school, in a straight line.`, links: [DESIGN] },
  { key: dialSourceKey('newBusRiders'), label: 'New bus riders', tag: 'M', explain: 'Simulated PPS kids at their zone school past the walk limit whose zone before any change was within it.', links: [DESIGN] },
  { key: dialSourceKey('k5Class'), label: 'Avg K-5 class', tag: 'M', explain: `Simulated K-5 kids per K-5 homeroom at open schools. Rooms fill to the class size target plus ${M.overload}, and cuts to homerooms make every class larger.`, links: [PPS_DATA] },
  { key: dialSourceKey('trust'), label: 'Trust', tag: 'M', explain: `Family trust, 0-100. ${TRUST}`, links: [DESIGN] },
  { key: dialSourceKey('kidsInUrm'), label: 'Kids in URM buildings', tag: 'M', explain: 'Simulated kids in unreinforced-masonry buildings (Holmes 2024) without a full retrofit. In fall 2025 about 4,500 attended URM buildings with no retrofit yet and 1,400 attended ones with a targeted retrofit.', links: [PPS_DATA] },
];
