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
  plantPerSqft: 9.57,
  // model.costGrowth
  costGrowth: 0.035,
  // model.revenuePerStudent
  revenueBase: 7_000,
  revenuePoverty: 6_000,
  directCertForMaxWeight: 0.63,
  // model.levy
  levyRate: 1.99,
  levyNet: 103_900_000,
  // model.compression
  compression: 53_400_000,
  compressionPower: 1.5,
  // budget.generalFund
  generalFund: 862_100_000,
  // model.reserves
  reserves: 41_100_000,
  // model.gap2027
  startGap: -65_200_000,
  // model.midYearCuts
  midYearFloor: 0.03,
};
