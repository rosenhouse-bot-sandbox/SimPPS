import { M } from './model';
import { clamp, SCHOOL_INFO } from './population';
import type { Budget, BudgetLine, Policy, SchoolState } from './types';

export const FIRST_YEAR = 2027;

/** Homerooms for one school's grades K-8. K-5 blends small remainders of neighboring grades. */
export function classesFor(byGrade: number[], classSize: number): { homerooms: number; blended: number } {
  const cap = classSize + M.overload;
  let homerooms = 0;
  let blended = 0;
  let waiting = 0;
  for (let g = 0; g <= 5; g++) {
    const n = byGrade[g];
    if (n === 0) continue;
    const full = Math.floor(n / classSize);
    const rest = n - full * classSize;
    homerooms += full;
    if (rest === 0 || (full > 0 && rest <= full * M.overload)) continue;
    if (rest >= classSize * M.ownRoomShare) {
      homerooms++;
    } else if (waiting > 0 && waiting + rest <= cap) {
      homerooms++;
      blended++;
      waiting = 0;
    } else {
      if (waiting > 0) homerooms++;
      waiting = rest;
    }
  }
  if (waiting > 0) homerooms++;
  for (let g = 6; g < byGrade.length; g++) homerooms += Math.ceil(byGrade[g] / M.msClassSize);
  return { homerooms, blended };
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
  const draw = clamp(input.policy.reserveDraw, 0, input.reserves);
  return {
    lines,
    gap,
    autoCutPositions: Math.ceil(Math.max(0, -gap - draw) / (M.positionCost * index)),
    reserves: input.reserves,
    reservePct: input.reserves / generalFund(input.year - 1),
  };
}
