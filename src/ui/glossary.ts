/** Plain-language definitions of the game's labels, for parents new to school-district jargon. */
export const GLOSSARY = {
  // Top bar and gap bar
  Kids: 'Students in kindergarten through 8th grade at the 74 PPS schools in this game. High schools are not simulated.',
  Capture:
    'The share of K-8 kids living in the district who attend a PPS school. The rest go to private, charter or other schools.',
  Reserves:
    "PPS's savings for emergencies, as a share of a year's spending. District policy sets a floor of 5%.",
  Trust: 'How much families trust the district, from 0 to 100. Closing schools lowers it, and it sways levy votes.',
  Gap: "How far next school year's costs exceed revenue. The district must close it with cuts, savings or new money.",
  Surplus: "Money left over after next school year's costs. It goes into reserves.",
  Cuts: 'Staff positions eliminated to close the gap, in June and in the middle of the year.',

  // School sheet
  'Enrolled 25-26': 'Students enrolled at this school in fall 2025, as reported to the state.',
  Capacity: 'How many students the building can serve, by PPS’s own measure of usable classrooms.',
  Utilization: 'Enrollment divided by capacity. Below 100% means empty seats; above 100% means crowding.',
  Built: 'The year the main building was built.',
  URM: 'Unreinforced masonry. Brick walls without steel, which can collapse in an earthquake.',
  'Retrofit left':
    'The estimated cost to finish strengthening this campus against earthquakes, from a 2024 engineering study.',
  'Direct cert.':
    'Direct certification: the share of students who get free meals automatically because their families get food stamps (SNAP), cash aid (TANF) or foster care. It is a measure of deep poverty.',
  DLI: 'Dual Language Immersion. Students learn in English and another language, such as Spanish, Chinese, Japanese, Russian or Vietnamese.',
  Simulated: 'Numbers the game computes as you play, not real data. A “~” marks a modeled number.',
  Enrollment: 'Students the game expects at this school. It shows a range because family choices involve chance.',
  Homerooms: 'Classes where a group of K-5 kids spends the day with one teacher.',
  Blended: 'Classes that mix two grades in one room, used when a grade is too small for its own class.',

  // Budget
  'K-5 class size': 'The target number of kids in each kindergarten-through-5th-grade class. Smaller classes need more teachers.',
  Levy: 'A local property tax that voters approve for up to 5 years to pay for teachers. The rate is dollars per $1,000 of a property’s assessed value.',
  'Election bill': 'What the county charges PPS to put a measure on the ballot.',
  'Levy ballot': 'The election, in May or November, where voters decide on the levy.',
  'Reserve draw': 'Money taken from reserves to shrink this year’s gap. It helps only once.',
  'Automatic cuts': 'If a gap remains after any reserve draw, the district cuts staff positions to close it.',

  // Edit chips
  Seats: 'Kids at a school over the seats its building has.',
  Walk: "The change in the average straight-line distance from kids' homes to school.",
  Now: 'Money this change saves (+) or costs (−) in the coming school year, including one-time costs.',
  'At maturity': 'Money this change saves (+) or costs (−) each year once it has fully taken effect.',
  'Pays off': 'A closure saves money only if enough kids stay in PPS, because each kid who leaves takes $7-13K a year of state funding.',
  'New bus riders': 'Kids who need a bus because a change put their school past walking distance: 1 mile for K-5, 1.5 miles for 6-8.',
  'K-5 walkers': 'K-5 kids who live within 1 mile of their school, in a straight line.',
  Blocks: 'The squares the game draws zones with. Each is 250 m across, about 4 by 4 city blocks.',

  // Close & send
  'Send kids to': "The 1 or 2 schools, called receivers, that take the closing school's kids.",
  Building: 'What happens to the empty building once its school closes.',
  Shares: "How the closing school's kids split between the receiving schools.",
  Mothball: 'Keep the empty building closed but maintained, so it can reopen later. Upkeep still costs money.',
  Lease: 'Rent the empty building to a tenant who pays its upkeep.',
  Sell: 'Sell the building for good. Sale money goes to buildings and repairs, not teachers.',
  'Call it': "Guess how many of the closing school's kids will stay in PPS. The year-end report shows how close you came.",

  // Zone mode
  Zone: 'The area whose kids a school takes by default. K-5/K-8 zones cover the early grades, and 6-8 zones cover middle school.',
  Slice: "Move the part of a neighboring zone nearest your school, sized as a share of that zone's kids.",
  Grandfather: 'Let enrolled kids stay at their current school. Only new kindergartners and 6th graders follow the new boundary.',

  // Year report
  'Where kids went': "Where last year's K-8 kids are this fall.",
  Stayed: 'Kids who stayed at their school, or moved up to their usual middle school.',
  'Moved in PPS': 'Kids who switched to a different PPS school.',
  'Came back': 'Kids who returned to PPS from private, charter or other schools.',
  'New kindergartners': 'Kindergartners who enrolled in PPS this fall.',
  'Kids now': 'All K-8 kids in PPS this fall.',
  'Left PPS': 'Kids who moved away or switched to a private, charter or other school.',
  'To high school': '8th graders who moved on to high school, which the game does not simulate.',
  'Other PPS': 'Kids who went to a PPS school other than the one planned for them.',
  'Levy vote': 'The election on the levy. It passes with more than half the votes.',
  'Do-nothing ghost': 'A copy of the district that changes nothing, played with the same luck as yours. It shows what your choices did.',
  'The Bulletin': 'Headlines written from the game’s totals. They never describe real families.',
  'Hidden card':
    'An assumption no one knows for sure. The game secretly draws one value when it starts and reveals it after 3 years.',
  'Kindergarten capture': 'The share of kindergartners living in the district who enroll in PPS.',
  'Positions cut': 'Staff positions eliminated by automatic and mid-year cuts this year.',
  'Kids in URM': 'Kids in unreinforced masonry buildings that have not had a full earthquake retrofit.',
  'Avg K-5 class': 'The average number of kids in a K-5 class.',
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;

export function define(term: GlossaryTerm): string {
  const text: string | undefined = GLOSSARY[term];
  if (!text) throw new Error(`No definition for "${term}"`);
  return text;
}
