import type { Household } from './types';

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

/** Model constants. Each has a source in src/sources/model.ts under the key in its comment. */
export const M = {
  // model.households
  outsideKids: 8_000,
  inZoneShare: 0.8,
  focusInZoneShare: 0.5,
  /** Each older grade holds this much more than the one below it. */
  gradeTilt: 0.005,
  // model.exitCapacity
  directCertForZeroExit: 0.65,
  // model.kCapture
  kCapture2025: 0.74,
  kCapture2028: 0.79,
  // model.cohortTrend, fitted with the moving roll to model.forecast
  cohortTrend: -0.018,
  // model.movingRoll
  leaveRate: 0.015,
  awayShare: 0.5,
  returnRate: 0.03,
  // model.grade6
  grade6Exit: 0.03,
  grade6Return: 0.06,
  feederShare: 0.75,
  // model.worseYear
  classSizeExitPerKid: 0.0025,
  cutsExitPer100Positions: 0.0012,
  worseYearCap: 0.01,
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
  // model.gap2027
  startGap: -65_200_000,
  // model.midYearCuts
  midYearFloor: 0.03,
  // model.closureSavings
  closureSavingsSpread: 0.15,
  /** Positions: a principal and an office manager. */
  principalOffice: 2,
  // model.closurePhasing: the share of a closure's saving in its first, second and third year
  closurePhasing: [0, 0.5, 1],
  // model.closureOneTime
  closureOneTime: { lo: 300_000, hi: 600_000 },
  // model.buildingFate
  mothball: 70_000,
  // model.followRate
  followSchoolSpread: 0.05,
  // model.followAdjustments
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
  // model.walkLimit
  walkLimitK5: 1,
  walkLimitMiddle: 1.5,
  walkDialMiles: 1,
  // model.busing: dollars a year per new rider
  busRider: { lo: 1_000, hi: 1_800 },
  // model.busReimbursement: the share the state repays a year later
  busReimbursed: { lo: 0.7, hi: 0.9 },
};

export const METERS_PER_MILE = 1609.34;
