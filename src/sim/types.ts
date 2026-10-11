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
  zoneSchool: SchoolId;
  /** null when the household's kids are outside PPS. */
  school: SchoolId | null;
  exitCapacity: number;
  loyalty: number;
  voice: number;
  status: HouseholdStatus;
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
}
