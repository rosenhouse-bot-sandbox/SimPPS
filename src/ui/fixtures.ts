import { fixtureSchools } from '../map/fixtures';
import { DEFAULT_POLICY, defaultZones } from '../sim';
import type { GameState, YearReport } from '../sim/types';

export const FIXTURE_GAME: GameState = {
  seed: 'fixture',
  year: 2027,
  schools: fixtureSchools(),
  households: [],
  budget: {
    lines: [{ key: 'generalFund', label: 'General fund', amount: 862_100_000, sourceKey: 'model.generalFund' }],
    gap: -65_200_000,
    reserveDraw: 0,
    autoCutPositions: 421,
    spending: 827_000_000,
    reserves: 41_100_000,
    reservePct: 0.048,
    reservesAfter: 41_100_000,
    reservePctAfterDraw: 0.0497,
    midYearCuts: 0,
  },
  dials: {
    kids: 26_400,
    capture: 0.766,
    kindergartenCapture: 0.74,
    gap: -65_200_000,
    positionsCut: 0,
    reservePct: 0.048,
    kidsInUrm: 4_500,
    walkK5: 9_000,
    newBusRiders: 0,
    trust: 35,
    k5Class: 24,
  },
  policy: DEFAULT_POLICY,
  zones: defaultZones(),
};

export const FIXTURE_REPORT: YearReport = {
  year: 2027,
  events: [
    { season: 'spring', title: 'Lottery runs', detail: 'Entering families choose schools.', sourceKey: 'model.kCapture' },
    { season: 'spring', title: 'Budget closes', detail: 'June cuts reach every school.', sourceKey: 'model.autoCuts' },
    { season: 'summer', title: 'Buildings stay put', detail: 'No closures take effect.', sourceKey: 'model.graduates' },
    { season: 'fall', title: 'Families settle', detail: 'Movers choose new schools.', sourceKey: 'model.movingRoll' },
    { season: 'october', title: 'Classes form', detail: 'Blended classes rise in small schools.', sourceKey: 'model.homerooms' },
    { season: 'winter', title: 'Costs land', detail: 'Pensions and compression grow.', sourceKey: 'model.costGrowth' },
  ],
  flows: { stayed: 22_100, movedWithinPps: 820, leftPps: 610, cameBack: 140, enteredK: 2_900, graduated: 3_100 },
  vsGhost: [
    { dial: 'positionsCut', you: 270, ghost: 420, better: true },
    { dial: 'kids', you: 26_050, ghost: 26_075, better: false },
    { dial: 'gap', you: -43_000_000, ghost: -65_200_000, better: true },
    { dial: 'capture', you: 0.765, ghost: 0.766, better: false },
  ],
  headlines: [
    { text: 'Cuts reach every school: 270 positions', sourceKey: 'model.autoCuts' },
    { text: 'Enrollment falls to ~26,050', sourceKey: 'dial.kids' },
    { text: 'Leavers run highest in North: ~2.4%', sourceKey: 'model.movingRoll' },
    { text: 'A fourth headline', sourceKey: 'model.movingRoll' },
  ],
  budget: FIXTURE_GAME.budget,
  closures: [],
  conversions: [],
  programMoves: [],
  reveals: [],
};
