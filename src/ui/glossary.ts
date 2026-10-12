import { SCHOOLS } from '../data';
import { DEFAULT_POLICY } from '../sim';
import { CELL_METERS } from '../sim/grid';
import { M, REVEAL_AFTER_YEARS } from '../sim/model';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const $k = (n: number) => `$${Math.round(n / 1e3)}K`;
const miles = (n: number) => `${n} mile${n === 1 ? '' : 's'}`;
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth'];
const classTarget = DEFAULT_POLICY.k5ClassSize;

/** Plain-language definitions of the game's labels, for parents new to school-district jargon. */
export const GLOSSARY = {
  // Top bar and gap bar
  Kids: `Students in kindergarten through 8th grade at the ${SCHOOLS.length} PPS schools in this game. High schools are not simulated.`,
  Capture: 'The share of K-8 kids living in the district who attend a PPS school. The rest go to private, charter or other schools.',
  Reserves: `Money PPS has saved, as a share of last year's spending. PPS aims to keep at least ${pct(M.reservePolicy)}. Below ${pct(M.midYearFloor)}, the game forces mid-year cuts.`,
  Trust: `How much families trust the district, from 0 to 100. Closures, moving kids twice, staff cuts and K-5 classes above ${classTarget} lower it, and calm years raise it. Higher trust means more yes votes on the levy.`,
  Gap: "Next school year's revenue minus its costs. A negative number is a shortfall the district must close with cuts, reserves or new money.",
  Surplus: "Money left over after next school year's costs. It goes into reserves.",
  Cuts: 'Staff positions eliminated to close the gap, in June and in the middle of the year.',

  // School sheet
  'Enrolled 25-26': "Students enrolled at this school in fall 2025, as reported to the state. A few schools' counts come from Portland State University's forecast instead.",
  Capacity: 'How many students the building can serve, by PPS’s own measure of usable classrooms.',
  Utilization: 'Enrollment divided by capacity. Below 100% means empty seats; above 100% means crowding.',
  URM: 'Unreinforced masonry. Brick or stone walls without steel reinforcing, which can collapse in an earthquake.',
  'Retrofit left': "A 2024 engineering firm's rough estimate to fully strengthen this campus against earthquakes. $0 means it was recently rebuilt or modernized.",
  'Direct cert.':
    'Direct certification: the share of students who get free meals automatically because their family gets benefits like food stamps (SNAP) or cash aid (TANF), or they are in foster care. It is a rough sign of deep poverty (2022 data).',
  DLI: 'Dual Language Immersion. Students learn in English and another language, such as Spanish, Mandarin Chinese, Japanese, Russian or Vietnamese.',
  'DLI 25-26': 'The Dual Language Immersion programs this school had in fall 2025, before any moves.',
  Simulated: 'Numbers the game computes as you play, not real data. A “~” marks a modeled number.',
  Enrollment: 'Students the game expects at this school. It shows a range because family choices involve chance.',
  Homerooms: 'Classes where a group of K-5 kids spends the day with one teacher.',
  Blended: 'Classes that mix two grades in one room, used when a grade is too small for its own class.',
  'Capacity as K-8': 'How many students the building could serve as a K-8, by PPS’s own measure. It now teaches only K-5.',
  'K-5 seats': 'How many K-5 students the building can serve now that its grades 6-8 have moved to a middle school.',
  'DLI kids': "Kids in each of this school's Dual Language Immersion programs, as the game simulates them. None means its program moved away.",

  // Budget
  'K-5 class size': 'The target number of kids in each kindergarten-through-5th-grade class. Smaller classes need more teachers.',
  Levy: `A local property tax that voters approve for up to ${M.levyYears} years to pay for teachers. The rate is dollars per $1,000 of a property’s assessed value.`,
  'Election bill': 'What the county charges PPS to put a measure on the ballot.',
  'Levy ballot': 'The election, in May or November, where voters decide on the levy.',
  'Reserve draw': 'Money taken from reserves to shrink this year’s gap. It helps only once.',
  'Automatic cuts': 'If a gap remains after any reserve draw, the district cuts staff positions to close it.',

  // Edit chips
  Seats: 'Kids at the receiving school(s) / seats in their buildings.',
  Walk: "The change in the average straight-line distance from kids' homes to school.",
  Now: 'Money this change saves (+) or costs (−) in the coming school year, including one-time costs.',
  'At maturity': 'Money this change saves (+) or costs (−) each year once it has fully taken effect.',
  'Pays off': `A closure saves money only if enough kids stay in PPS, because each kid who leaves PPS costs about ${$k(M.revenueBase)}–${Math.round((M.revenueBase + M.revenuePoverty) / 1e3)}K a year in state money, starting the next year.`,
  'New bus riders': `Kids who need a bus because a change put their school past walking distance: ${miles(M.walkLimitK5)} for K-5, ${miles(M.walkLimitMiddle)} for 6-8.`,
  'K-5 walkers': `K-5 kids who live within ${miles(M.walkDialMiles)} of their school, in a straight line.`,
  Blocks: `The squares the game draws zones with. Each is ${CELL_METERS} m across, about 4 by 4 city blocks.`,

  // Close & send
  'Send kids to': "The 1 or 2 schools, called receivers, that take the closing school's kids.",
  Building: 'What happens to the empty building once its school closes.',
  Shares: "How the closing school's kids split between the receiving schools.",
  Mothball: 'Keep the empty building closed but maintained, so it can reopen later. Upkeep still costs money.',
  Lease: 'Rent the empty building to a tenant who pays its upkeep.',
  Sell: 'Sell the building for good. It can never reopen. The game counts no sale money, because sale money goes to building projects, not the yearly budget.',
  'Call it': "Guess how many of the closing school's kids will stay in PPS. The year-end report shows how close you came.",

  // Zone mode
  Zone: 'The area whose kids a school takes by default. K-5/K-8 zones cover the early grades, and 6-8 zones cover middle school.',
  Slice: "Move the part of a neighboring zone nearest your school, sized as a share of that zone's kids.",
  Grandfather: 'Let enrolled kids stay at their current school. Only new kindergartners, new 6th graders and kids returning to PPS follow the new boundary.',

  // Year report
  'Where kids went': "Where last year's K-8 kids are this fall.",
  'Moved in PPS': 'Kids who switched to a different PPS school.',
  'Came back': 'Kids who returned to PPS from private, charter or other schools.',
  'Left PPS': 'Kids who moved away or switched to a private, charter or other school.',
  'To high school': '8th graders who moved on to high school, which the game does not simulate.',
  'Other PPS': 'Kids who went to a PPS school other than the one planned for them.',
  'New zone school': 'Re-zoned kids who went to the school their home is now zoned for.',
  'Left DLI': "Kids in a moved Dual Language Immersion program who didn't follow it but stayed in PPS. Kids whose school closed count with the closure too.",
  'Levy vote': 'The election on the levy. It passes when yes votes outnumber no votes.',
  'Do-nothing ghost': 'A copy of the district that changes nothing, played with the same luck as yours. It shows what your choices did.',
  'The Bulletin': 'Headlines written from the game’s totals. They never describe real families.',
  'Hidden card': `An assumption no one knows for sure. The game secretly draws one value when it starts and reveals it in the report at the end of your ${ORDINALS[REVEAL_AFTER_YEARS - 1]} year.`,
  'Kindergarten capture': 'The share of kindergartners living in the district who enroll in PPS.',
  'Positions cut': 'Staff positions eliminated by automatic and mid-year cuts this year.',
  'Kids in URM': 'Kids in unreinforced masonry buildings that have not had a full earthquake retrofit.',
  'Avg K-5 class': 'The average number of kids in a K-5 class.',
} satisfies Record<string, string>;

export type GlossaryTerm = keyof typeof GLOSSARY;

/** Labels that need no definition. */
export type PlainLabel = 'Built' | 'Stayed' | 'New kindergartners' | 'Kids now';

export function isTerm(label: GlossaryTerm | PlainLabel): label is GlossaryTerm {
  return label in GLOSSARY;
}
