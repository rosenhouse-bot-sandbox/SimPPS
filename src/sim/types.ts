import type { Point } from '../data';

export type SchoolId = string;
export type Season = 'spring' | 'summer' | 'fall' | 'october' | 'winter';

/** A modeled value. The UI shows it as "lo–hi~". */
export interface Range {
  lo: number;
  hi: number;
}

export interface Closure {
  school: SchoolId;
  receivers: { school: SchoolId; share: number }[];
  building: 'mothball' | 'lease' | 'sell';
}

/** The player's edits for the coming year. */
export interface Policy {
  /** K-5 class size target, 22–28. Today it is 24. */
  k5ClassSize: number;
  /** Local-option levy, in dollars per $1,000 of assessed value. 0 lets it lapse. */
  levyRate: number;
  /** Dollars drawn from reserves this year. */
  reserveDraw: number;
  closures: Closure[];
}

export type HouseholdStatus = 'stayed' | 'moved' | 'left' | 'returned';

export interface Household {
  id: number;
  pos: Point;
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
}

export interface SchoolState {
  id: SchoolId;
  open: boolean;
  enrollment: number;
  /** Enrollment per grade, index 0 = K … 8 = grade 8. */
  byGrade: number[];
  capacity: number;
  homerooms: number;
  blendedHomerooms: number;
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
  autoCutPositions: number;
  reserves: number;
  reservePct: number;
}

export interface Dials {
  kids: number;
  capture: number;
  kindergartenCapture: number;
  gap: number;
  positionsCut: number;
  reservePct: number;
  kidsInUrm: number;
}

export interface SeasonEvent {
  season: Season;
  title: string;
  detail: string;
  school?: SchoolId;
  sourceKey?: string;
}

export interface Flows {
  stayed: number;
  movedWithinPps: number;
  leftPps: number;
  cameBack: number;
}

export interface YearReport {
  /** Fall year of the school year that just played (2027 = 2027-28). */
  year: number;
  events: SeasonEvent[];
  flows: Flows;
  /** Largest gaps against the do-nothing ghost, biggest first. */
  vsGhost: { dial: keyof Dials; you: number; ghost: number; better: boolean }[];
  headlines: string[];
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
  /** Positions removed by automatic and mid-year cuts so far. */
  cumulativeCuts: number;
  /** The lumped rest of the general fund, in 2027-28 dollars. */
  restRevenue: number;
  restCost: number;
  /** Hidden cards drawn for this game. */
  cards: { followRate: number; closedZoneCaptureDrop: number };
  /** The do-nothing ghost: same luck, DEFAULT_POLICY every year. */
  ghost?: GameState;
}
