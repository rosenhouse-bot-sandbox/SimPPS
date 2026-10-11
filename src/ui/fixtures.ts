import { SCHOOLS } from '../data';
import { DEFAULT_POLICY } from '../sim';
import type { GameState, SchoolState, YearReport } from '../sim/types';

function schoolState(id: string, enrollment: number, capacity: number): SchoolState {
  const perGrade = Math.round(enrollment / 6);
  return {
    id,
    open: true,
    enrollment,
    byGrade: [perGrade, perGrade, perGrade, perGrade, perGrade, perGrade, 0, 0, 0],
    capacity,
    homerooms: Math.max(1, Math.round(enrollment / 24)),
    blendedHomerooms: enrollment < 300 ? 2 : 0,
  };
}

export const FIXTURE_GAME: GameState = {
  seed: 'fixture',
  year: 2027,
  schools: Object.fromEntries(
    SCHOOLS.map((s) => [s.id, schoolState(s.id, s.enrollment ?? 0, s.capacity ?? 0)]),
  ),
  households: [],
  budget: {
    lines: [{ key: 'generalFund', label: 'General fund', amount: 862_100_000, sourceKey: 'budget.generalFund' }],
    gap: -65_200_000,
    autoCutPositions: 421,
    reserves: 41_100_000,
    reservePct: 0.048,
  },
  dials: {
    kids: 26_400,
    capture: 0.766,
    kindergartenCapture: 0.74,
    gap: -65_200_000,
    positionsCut: 0,
    reservePct: 0.048,
    kidsInUrm: 4_500,
  },
  policy: DEFAULT_POLICY,
};

export const FIXTURE_REPORT: YearReport = {
  year: 2027,
  events: [
    { season: 'spring', title: 'Lottery runs', detail: 'Entering families choose schools.' },
    { season: 'spring', title: 'Budget closes', detail: 'June cuts reach every school.', sourceKey: 'model.autoCuts' },
    { season: 'summer', title: 'Buildings stay put', detail: 'No closures take effect.' },
    { season: 'fall', title: 'Families settle', detail: 'Movers choose new schools.' },
    { season: 'october', title: 'Classes form', detail: 'Blended classes rise in small schools.' },
    { season: 'winter', title: 'Costs land', detail: 'Pensions and compression grow.' },
  ],
  flows: { stayed: 24_100, movedWithinPps: 820, leftPps: 610, cameBack: 140 },
  vsGhost: [
    { dial: 'positionsCut', you: 270, ghost: 420, better: true },
    { dial: 'kids', you: 26_050, ghost: 26_075, better: false },
    { dial: 'gap', you: -43_000_000, ghost: -65_200_000, better: true },
    { dial: 'capture', you: 0.765, ghost: 0.766, better: false },
  ],
  headlines: ['CUTS REACH EVERY SCHOOL', 'Kindergarten sign-ups dip', 'Reserves fall below policy', 'A fourth headline'],
};
