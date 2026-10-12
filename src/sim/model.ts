import type { Household, ModelOverrides } from './types';

export const MAX_GRADE = 8;

export function gradeOf(h: Household): number {
  return h.kids.indexOf(1);
}

export function oneKid(grade: number): number[] {
  const kids = new Array<number>(MAX_GRADE + 1).fill(0);
  kids[grade] = 1;
  return kids;
}

/** Hidden card model.followRate: the share of a closed school's kids who follow it. */
export const FOLLOW_RATES = [0.95, 0.88, 0.8, 0.65];
/** Hidden card model.closedZoneCapture: how far a closed zone's kindergarten capture falls. */
export const CLOSED_ZONE_CAPTURE_DROPS = [0, 0.02, 0.05];

/** Model parameters. Each has a source in src/sources/model.ts under the key in its comment. */
const defaults = () => ({
  // model.households
  outsideKids: 8_000,
  inZoneShare: 0.8,
  focusInZoneShare: 0.5,
  /** Each older grade holds this much more than the one below it. */
  gradeTilt: 0.005,
  outsideBaseWeight: 0.5,
  // model.exitCapacity
  directCertForZeroExit: 0.65,
  exitNoise: 0.2,
  exitMin: 0.02,
  exitMax: 0.98,
  // model.loyalty
  loyaltyNoise: 0.2,
  // model.voice
  voiceBase: 0.1,
  voicePerExit: 0.4,
  voiceNoise: 0.2,
  // model.kCapture
  kCapture2025: 0.74,
  kCapture2028: 0.79,
  kCaptureMax: 0.98,
  // model.cohortTrend, fitted with the moving roll to model.forecast
  cohortTrend: -0.018,
  // model.movingRoll
  leaveRate: 0.015,
  leaveBase: 0.7,
  leavePerExit: 0.6,
  awayShare: 0.5,
  returnRate: 0.03,
  // model.grade6
  grade6Exit: 0.03,
  grade6Return: 0.06,
  feederShare: 0.75,
  // model.worseYear
  baseClassSize: 24,
  classSizeExitPerKid: 0.0025,
  cutsExitPer100Positions: 0.0012,
  worseYearCap: 0.01,
  betterYearCap: 0.005,
  worseBase: 1.25,
  worsePerLoyalty: 0.5,
  // model.schoolRange
  rangeShare: 0.05,
  rangeExtra: 2,
  // model.homerooms
  homeroomCost: 159_600,
  msClassSize: 26,
  overload: 2,
  // model.staffSteps
  staffSteps: [
    [300, 6],
    [450, 7],
    [600, 8],
    [Infinity, 10],
  ] as const,
  // model.positionCost
  positionCost: 155_000,
  // model.plant
  plantPerSqft: 13.8,
  // model.costGrowth
  costGrowth: 0.035,
  // model.revenuePerStudent
  revenueBase: 7_000,
  revenuePoverty: 6_000,
  directCertForMaxWeight: 0.63,
  // model.stateFunding
  stateFunding2025: 11_360_000_000,
  stateFundingCeiling: 12_560_000_000,
  /** Students outside the K-8 simulation in fall 2025: 42,622 in all less 26,966. */
  otherStudents: 15_656,
  // model.levy
  levyRate: 1.99,
  levyNet: 103_900_000,
  // model.compression
  compression: 53_400_000,
  compressionPower: 1.5,
  // model.generalFund
  generalFund: 862_100_000,
  // model.reserves
  reserves: 41_100_000,
  /** PPS's reserve policy floor, as a share of spending [V]. */
  reservePolicy: 0.05,
  // model.gap2027
  startGap: -65_200_000,
  // model.midYearCuts
  midYearFloor: 0.03,
  midYearPayShare: 0.5,
  // model.surplus
  surplusRehire: 0,
  // model.closureSavings
  closureSavingsSpread: 0.15,
  /** Positions: a principal and an office manager. */
  principalOffice: 2,
  // model.closurePhasing: the share of a closure's saving in its first, second and third year
  closurePhasing: [0, 0.5, 1],
  // model.closureOneTime
  closureOneTime: { lo: 300_000, hi: 600_000 },
  oneTimeFromReserves: 0,
  // model.buildingFate
  mothball: 70_000,
  // model.followRate
  followSchoolSpread: 0.05,
  followShift: 0,
  // model.followAdjustments
  followFreeMiles: 1,
  followPerMilePastOne: 0.03,
  followBarrier: 0.04,
  followRiskier: 0.03,
  followMovedTwice: 0.08,
  followLoyal: 0.05,
  followExit: 0.04,
  followWholeClasses: 0.03,
  // model.nonFollowers
  nonFollowerOtherPps: 0.35,
  nonFollowerCharter: 0.1,
  // model.crowding
  crowdingLine: 1.1,
  // model.sliceStay: the chance a kid re-zoned off its school goes to the new zone school
  sliceStay: 0.97,
  // model.gradeSpan
  conversionStay: 0.95,
  /** A K-5 room seats 24 and a middle-grade room 26, and a third of a K-8's rooms held grades 6-8. */
  conversionCapacity: (6 + (3 * 24) / 26) / 9,
  // model.programMove
  programMoveStay: 0.85,
  programFarMiles: 2,
  programStayPerMile: 0.03,
  // model.walkLimit
  walkLimitK5: 1,
  walkLimitMiddle: 1.5,
  walkDialMiles: 1,
  // model.busing: dollars a year per new rider
  busRider: { lo: 1_000, hi: 1_800 },
  // model.busReimbursement: the share the state repays a year later
  busReimbursed: { lo: 0.7, hi: 0.9 },
  // model.trust: points on a 0-100 scale
  trustStart: { lo: 30, hi: 40 },
  trustClosure: 8,
  trustMovedTwice: 5,
  trustCalmYear: 2,
  trustPer100PositionsCut: 1,
  trustPerKidOver24: 1,
  // model.levyTerm: the fall year of the levy's last school year
  levyThrough: 2029,
  levyYears: 5,
  // model.election
  yesBase: 0.71,
  yesPerTrustPoint: 0.012,
  /** Per $0.10 per $1,000 above today's rate. */
  yesPerDime: 0.03,
  yesPerFailure: 0.04,
  yesNoise: 0.06,
  pollSpread: 0.05,
  // model.electionBill
  electionBill: 500_000,
  // model.classrooms
  classroomsK5: 0,
  classroomsMiddle: 375,
});

export type Model = ReturnType<typeof defaults>;

function deepFreeze<T extends object>(o: T): Readonly<T> {
  for (const v of Object.values(o)) if (typeof v === 'object' && v !== null) deepFreeze(v);
  return Object.freeze(o);
}

export const MODEL_DEFAULTS: Readonly<Model> = deepFreeze(defaults());

/** The parameters of the game being played. setModelParams changes them in place. */
export const M: Model = defaults();

const isRange = (v: unknown): v is { lo: number; hi: number } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { lo: unknown }).lo === 'number';

/** Every parameter a game can change: scalars by name and ranges as "name.lo" and "name.hi". */
export const PARAM_PATHS: readonly string[] = Object.entries(MODEL_DEFAULTS).flatMap(([key, v]) =>
  typeof v === 'number' ? [key] : isRange(v) ? [`${key}.lo`, `${key}.hi`] : [],
);

export function defaultValue(path: string): number {
  const [key, end] = path.split('.');
  const v = (MODEL_DEFAULTS as Record<string, unknown>)[key];
  return end ? (v as Record<string, number>)[end] : (v as number);
}

/** Resets M to the defaults, then applies each known override that is a finite number. */
export function setModelParams(overrides: ModelOverrides = {}): void {
  Object.assign(M, defaults());
  for (const [path, value] of Object.entries(overrides)) {
    if (!PARAM_PATHS.includes(path) || !Number.isFinite(value)) continue;
    const [key, end] = path.split('.');
    const m = M as unknown as Record<string, number | Record<string, number>>;
    if (end) (m[key] as Record<string, number>)[end] = value;
    else m[key] = value;
  }
}

/** model.classrooms: the Avg K-5 class dial becomes the Classrooms dial when a two-section floor is set. */
export function classroomsDial(): boolean {
  return M.classroomsK5 > 0;
}

/** The report that reveals the hidden cards comes after this many played years. */
export const REVEAL_AFTER_YEARS = 3;
/** Each hidden card in SimMemory['cards'] and its source key. */
export const HIDDEN_CARDS = { followRate: 'model.followRate', closedZoneCaptureDrop: 'model.closedZoneCapture' } as const;

export const METERS_PER_MILE = 1609.34;
