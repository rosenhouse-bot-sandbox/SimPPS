import type { Point } from '../data';

export type SchoolId = string;
export type Season = 'spring' | 'summer' | 'fall' | 'october' | 'winter';

/** A modeled value. The UI shows it as "lo–hi~". */
export interface Range {
  lo: number;
  hi: number;
}

export type BuildingFate = 'mothball' | 'lease' | 'sell';

/** Close a school and send its kids to 1-2 receivers. It takes effect in summer. */
export interface Closure {
  school: SchoolId;
  /** Shares sum to 1. */
  receivers: { school: SchoolId; share: number }[];
  /** A sold building can't reopen. */
  building: BuildingFate;
  /** The player's "Call it": how many of the school's kids stay in PPS. */
  guess?: number;
}

/** A closure in force since fall `year`. */
export interface ClosedSchool extends Closure {
  year: number;
  /** Yearly gross saving at maturity if all follow, in 2027-28 dollars. */
  saving: number;
  /** Staff positions that followed the kids beyond the receivers' new staff steps. */
  staffKept: number;
}

/** A K-8 school sends grades 6-8 to a middle school and serves K-5. It takes effect in summer. */
export interface GradeSpanChange {
  school: SchoolId;
  to: SchoolId;
}

/** A grade-span change in force since fall `year`. */
export interface ConvertedSchool extends GradeSpanChange {
  year: number;
}

/** A Dual Language Immersion program. */
export type Program = 'Spanish' | 'Mandarin' | 'Japanese' | 'Russian' | 'Vietnamese';

/** A DLI program leaves its `from` schools for `to`. It takes effect in summer. */
export interface ProgramMove {
  program: Program;
  from: SchoolId[];
  to: SchoolId;
}

/** A program move in force since fall `year`. */
export interface MovedProgram extends ProgramMove {
  year: number;
}

export type ZoneLevel = 'elementary' | 'middle';

/** Blocks moved into `to`'s zone at one level. It takes effect in summer. */
export interface BoundaryEdit {
  level: ZoneLevel;
  to: SchoolId;
  /** Each is a zoneGrid() cell id. */
  cells: number[];
  /** Current students keep their school and zone; kids entering the level or PPS use the new zone. */
  grandfather: boolean;
}

/** Each zoneGrid() cell's zone school, by cell id. */
export interface ZoneMap {
  elementary: SchoolId[];
  middle: SchoolId[];
}

export type ElectionMonth = 'may' | 'november';

/** The voter-approved levy. It funds school years through fall `through`. */
export interface Levy {
  rate: number;
  through: number;
  /** Failed measures since the last one passed. */
  failures: number;
}

/** A levy measure on this year's ballot. A renewal asks to continue an expiring levy. */
export interface Ballot {
  rate: number;
  when: ElectionMonth;
  renewal: boolean;
}

/** The player's edits for the coming year. */
export interface Policy {
  /** K-5 class size target, 22–28. Today it is 24. */
  k5ClassSize: number;
  /** Local-option levy, in dollars per $1,000 of assessed value. 0 lets it lapse. A new rate needs a vote. */
  levyRate: number;
  /** The ballot for a levy measure. November renews ahead of expiry or moves a rate change to next year. */
  levyElection: ElectionMonth;
  /** Dollars drawn from reserves this year. */
  reserveDraw: number;
  closures: Closure[];
  boundaryEdits: BoundaryEdit[];
  gradeChanges: GradeSpanChange[];
  programMoves: ProgramMove[];
}

export type HouseholdStatus = 'stayed' | 'moved' | 'left' | 'returned';

export interface Household {
  id: number;
  pos: Point;
  /** The zoneGrid() cell holding pos. */
  cell: number;
  /** Kids per grade, index 0 = K … 8 = grade 8. */
  kids: number[];
  /** The elementary zone school for K-5 kids; the middle zone school for grades 6-8. */
  zoneSchool: SchoolId;
  /** null when the household's kids are outside PPS. */
  school: SchoolId | null;
  exitCapacity: number;
  loyalty: number;
  voice: number;
  status: HouseholdStatus;
  /** The household left Portland this year. It drops off the map next year. */
  movedAway?: boolean;
  /** The household's kids left PPS this year. Other 'left' households were outside PPS before. */
  leftThisYear?: boolean;
  /** The school a closure moved the household from this year, for map trails. */
  movedFrom?: SchoolId;
  /** Times a closure or boundary change has moved the household. */
  forcedMoves?: number;
  /** A closed school whose state funding weight the household's kids keep. */
  fundedAs?: SchoolId;
  /** The DLI program the kid is in, offered at its school. */
  program?: Program;
}

export interface SchoolState {
  id: SchoolId;
  open: boolean;
  enrollment: number;
  /** Enrollment per grade, index 0 = K … 8 = grade 8. */
  byGrade: number[];
  capacity: number;
  /** State K-8 revenue its kids bring, by each kid's funding weight. */
  stateRevenue: number;
  homerooms: number;
  k5Homerooms: number;
  blendedHomerooms: number;
  /** Set when a closure has emptied the building. */
  closed?: { year: number; building: BuildingFate };
  /** Set when a grade-span change sent grades 6-8 to `to`. */
  converted?: { year: number; to: SchoolId };
  /** Kids in each DLI program the school offers. */
  dli?: Partial<Record<Program, number>>;
}

export interface BudgetLine {
  key: string;
  label: string;
  /** Dollars per year. Revenue is positive, cost is negative. */
  amount: number;
  sourceKey: string;
}

export interface Budget {
  lines: BudgetLine[];
  /** Revenue minus costs before automatic cuts. Negative is a shortfall. */
  gap: number;
  /** The draw that applies: no more than the reserves or the shortfall. */
  reserveDraw: number;
  /** June cuts: the shortfall left after the draw. */
  autoCutPositions: number;
  /** Costs after June cuts. */
  spending: number;
  /** Reserves now, over last year's spending. */
  reserves: number;
  reservePct: number;
  /** Reserves after the draw, over this year's spending. */
  reservesAfter: number;
  reservePctAfterDraw: number;
  /** Winter cuts forced when reserves after the draw fall below 3%. */
  midYearCuts: number;
}

export interface Dials {
  kids: number;
  capture: number;
  kindergartenCapture: number;
  gap: number;
  positionsCut: number;
  reservePct: number;
  kidsInUrm: number;
  /** PPS K-5 kids within a mile of their school, straight line. */
  walkK5: number;
  /** PPS kids riding a bus only because a zone changed. */
  newBusRiders: number;
  /** Family trust, 0-100, averaged over households. */
  trust: number;
  /** K-5 kids per K-5 homeroom at open schools. */
  k5Class: number;
}

export interface SeasonEvent {
  season: Season;
  title: string;
  detail: string;
  sourceKey: string;
}

/** Kids now = stayed + movedWithinPps + cameBack + enteredK. */
export interface Flows {
  stayed: number;
  movedWithinPps: number;
  leftPps: number;
  cameBack: number;
  enteredK: number;
  graduated: number;
}

export interface Headline {
  text: string;
  sourceKey: string;
}

/** Where a closed school's kids went. Kids are those still in its grades this fall. */
export interface ClosureOutcome {
  school: SchoolId;
  kids: Range;
  receivers: { school: SchoolId; kids: Range }[];
  otherPps: Range;
  leftPps: Range;
  /** The player's "Call it", scored against the kids who stayed in PPS. */
  guess?: { stayInPps: number; actual: Range; hit: boolean };
}

/** Where kids went after a boundary change moved them off their zone school. */
export interface RezoneOutcome {
  kids: Range;
  zoneSchool: Range;
  otherPps: Range;
  leftPps: Range;
}

/** Where a converted K-8's moved middle graders went. */
export interface ConversionOutcome {
  school: SchoolId;
  to: SchoolId;
  kids: Range;
  receiver: Range;
  otherPps: Range;
  leftPps: Range;
}

/** Where a moved program's kids went. Kids are those still in their school's grades this fall. */
export interface ProgramMoveOutcome extends ProgramMove {
  kids: Range;
  receiver: Range;
  /** Kids who stayed in PPS without the program. */
  leftDli: Range;
  leftPps: Range;
}

/** A levy vote. Yes is a share of votes. */
export interface ElectionOutcome extends Ballot {
  yes: number;
  passed: boolean;
}

/** A hidden card this report reveals, with the value this game drew. */
export interface Reveal {
  sourceKey: string;
  value: number;
}

export interface YearReport {
  /** Fall year of the school year that just played (2027 = 2027-28). */
  year: number;
  events: SeasonEvent[];
  flows: Flows;
  /** Largest gaps against the do-nothing ghost, biggest first. */
  vsGhost: { dial: keyof Dials; you: number; ghost: number; better: boolean }[];
  headlines: Headline[];
  /** The June budget that applied. */
  budget: Budget;
  closures: ClosureOutcome[];
  conversions: ConversionOutcome[];
  programMoves: ProgramMoveOutcome[];
  /** Present when boundary edits moved kids off their zone school. */
  rezoned?: RezoneOutcome;
  /** Present when a levy measure went to voters. */
  election?: ElectionOutcome;
  /** The ghost's own levy vote, if it had one. */
  ghostElection?: ElectionOutcome;
  reveals: Reveal[];
}

export interface GameState {
  seed: string;
  /** Fall year of the school year being planned. Play starts in January 2027 planning 2027-28. */
  year: number;
  schools: Record<SchoolId, SchoolState>;
  households: Household[];
  budget: Budget;
  dials: Dials;
  policy: Policy;
  /** Zones after every boundary change and closure so far. */
  zones: ZoneMap;
  /** Simulation memory. newGame sets it; the UI can ignore it. */
  sim?: SimMemory;
}

/** Cumulative weights for picking a school. */
export interface SchoolChoice {
  ids: SchoolId[];
  cum: number[];
}

export interface SimMemory {
  seedHash: number;
  nextId: number;
  /** Per elementary zone: where its K-5 PPS kids go. */
  kChoice: SchoolChoice[];
  /** Citywide mix of middle schools, for grade-6 kids who skip the feeder. */
  msMix: SchoolChoice;
  /** Per elementary zone: share of its PPS K-5 kids at the zone school. */
  zoneKeep: number[];
  /** Per elementary zone: resident kindergartners in fall 2025, in and out of PPS. */
  kCohort: number[];
  /** Per elementary zone: share of those kindergartners in PPS. */
  kCapture: number[];
  /** Last year's K-5 class size target. */
  k5ClassSize: number;
  /** Positions removed by automatic and mid-year cuts so far. */
  cumulativeCuts: number;
  /** Last year's spending, the base for the reserve share. */
  spending: number;
  /** Homerooms removed by cuts so far. Class sizes creep up to absorb them. */
  homeroomsCut: number;
  /** The lumped rest of the general fund, in 2027-28 dollars. */
  restRevenue: number;
  restCost: number;
  /** Closures in force, oldest first. */
  closed: ClosedSchool[];
  /** Grade-span changes in force, oldest first. */
  converted: ConvertedSchool[];
  /** Program moves in force, oldest first. */
  programMoves: MovedProgram[];
  /** Busing dollars booked this year, which the state repays next year. */
  busing: number;
  levy: Levy;
  /** model.trust: family trust by region. */
  trust: Record<string, number>;
  /** Hidden cards drawn for this game. */
  cards: { followRate: number; closedZoneCaptureDrop: number };
  /** The do-nothing ghost: same luck, DEFAULT_POLICY every year. */
  ghost?: GameState;
}
