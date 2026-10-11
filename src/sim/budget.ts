import { M } from './model';
import { clamp, SCHOOL_INFO } from './population';
import type { Budget, BudgetLine, Policy, SchoolState } from './types';

export const FIRST_YEAR = 2027;

/**
 * Homerooms for one school's grades K-8. K-5 rooms fill to the target plus the overload across the
 * school, and grades that cannot each have their own rooms share blended classes.
 */
export function classesFor(byGrade: number[], classSize: number): { homerooms: number; blended: number } {
  const cap = classSize + M.overload;
  const k5 = byGrade.slice(0, 6);
  const k5Rooms = Math.ceil(k5.reduce((a, n) => a + n, 0) / cap);
  const sections = k5.reduce((a, n) => a + Math.ceil(n / cap), 0);
  let homerooms = k5Rooms;
  for (let g = 6; g < byGrade.length; g++) homerooms += Math.ceil(byGrade[g] / M.msClassSize);
  return { homerooms, blended: Math.min(k5Rooms, sections - k5Rooms) };
}

export function otherStaff(enrollment: number): number {
  return M.staffSteps.find(([below]) => enrollment < below)![1];
}

export function revenuePerStudent(directCert: number): number {
  return M.revenueBase + M.revenuePoverty * clamp(directCert / M.directCertForMaxWeight, 0, 1);
}

export function levyRevenue(rate: number): number {
  const r = rate / M.levyRate;
  return (M.levyNet + M.compression) * r - M.compression * r ** M.compressionPower;
}

export function costIndex(year: number): number {
  return (1 + M.costGrowth) ** (year - FIRST_YEAR);
}

/** The general fund for the school year starting in fall `year`; $862.1M in 2026-27. */
export function generalFund(year: number): number {
  return M.generalFund * costIndex(year + 1);
}

const MEDIAN_SQFT = (() => {
  const s = [...SCHOOL_INFO.values()].map((i) => i.data.squareFeet).filter((x): x is number => x !== null).sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
})();

export interface BudgetInput {
  year: number;
  schools: Record<string, SchoolState>;
  policy: Policy;
  reserves: number;
  /** Last year's spending. */
  priorSpending: number;
  cumulativeCuts: number;
  restRevenue: number;
  restCost: number;
}

/**
 * The plan for the school year starting in fall `year`. Costs come from the current cohorts at the
 * policy's class size; state revenue comes from the current (prior-year) count.
 */
export function computeBudget(input: BudgetInput): Budget {
  const index = costIndex(input.year);
  let state = 0;
  let homerooms = 0;
  let staff = 0;
  let plant = 0;
  for (const s of Object.values(input.schools)) {
    const info = SCHOOL_INFO.get(s.id)!;
    state += s.enrollment * revenuePerStudent(info.data.pctDirectCert ?? 0);
    if (!s.open) continue;
    homerooms += classesFor(s.byGrade, input.policy.k5ClassSize).homerooms;
    staff += otherStaff(s.enrollment);
    plant += (info.data.squareFeet ?? MEDIAN_SQFT) * M.plantPerSqft;
  }
  const lines: BudgetLine[] = [
    { key: 'stateK8', label: 'State school fund, K-8', amount: state, sourceKey: 'model.revenuePerStudent' },
    { key: 'levy', label: 'Local option levy, net', amount: levyRevenue(input.policy.levyRate), sourceKey: 'model.levy' },
    { key: 'restRevenue', label: 'Rest of district revenue', amount: input.restRevenue, sourceKey: 'model.restOfDistrict' },
    { key: 'homerooms', label: 'K-8 homeroom teachers', amount: -homerooms * M.homeroomCost * index, sourceKey: 'model.homerooms' },
    { key: 'staff', label: 'Other school staff', amount: -staff * M.positionCost * index, sourceKey: 'model.staffSteps' },
    { key: 'plant', label: 'Buildings', amount: -plant * index, sourceKey: 'model.plant' },
    { key: 'restCost', label: 'Rest of district costs', amount: -input.restCost * index, sourceKey: 'model.restOfDistrict' },
  ];
  if (input.cumulativeCuts > 0)
    lines.push({
      key: 'earlierCuts',
      label: 'Positions cut in earlier years',
      amount: input.cumulativeCuts * M.positionCost * index,
      sourceKey: 'model.autoCuts',
    });
  const gap = lines.reduce((sum, l) => sum + l.amount, 0);
  const revenue = state + levyRevenue(input.policy.levyRate) + input.restRevenue;
  const position = M.positionCost * index;
  const reserveDraw = clamp(input.policy.reserveDraw, 0, Math.min(input.reserves, Math.max(0, -gap)));
  const autoCutPositions = Math.ceil(Math.max(0, -gap - reserveDraw) / position);
  const spending = revenue - gap - autoCutPositions * position;
  const reservesAfter = input.reserves - reserveDraw + Math.max(0, gap);
  const floor = M.midYearFloor * spending;
  return {
    lines,
    gap,
    reserveDraw,
    autoCutPositions,
    spending,
    reserves: input.reserves,
    reservePct: input.reserves / input.priorSpending,
    reservesAfter,
    reservePctAfterDraw: reservesAfter / spending,
    midYearCuts: reservesAfter < floor ? Math.ceil((floor - reservesAfter) / (position / 2)) : 0,
  };
}
