import { M } from './model';
import { clamp } from '../clamp';
import { SCHOOLS } from '../data';
import { SCHOOL_INFO } from './population';
import { draw } from './rng';
import { effectiveClosures } from './closures';
import { busingCost, busReimbursement } from './walk';
import type { Budget, BudgetLine, ClosedSchool, Policy, SchoolId, SchoolState } from './types';

export const FIRST_YEAR = 2027;

/**
 * Homerooms for one school's grades K-8. K-5 rooms fill to the target plus the overload across the
 * school, and grades that cannot each have their own rooms share blended classes.
 */
export function classesFor(byGrade: number[], classSize: number, creep = 0): { homerooms: number; blended: number } {
  const cap = classSize + creep + M.overload;
  const k5 = byGrade.slice(0, 6);
  const k5Rooms = Math.ceil(k5.reduce((a, n) => a + n, 0) / cap);
  const sections = k5.reduce((a, n) => a + Math.ceil(n / cap), 0);
  let homerooms = k5Rooms;
  for (let g = 6; g < byGrade.length; g++) homerooms += Math.ceil(byGrade[g] / (M.msClassSize + creep));
  return { homerooms, blended: Math.min(k5Rooms, sections - k5Rooms) };
}

function totalHomerooms(schools: Record<string, SchoolState>, classSize: number, creep: number): number {
  let n = 0;
  for (const s of Object.values(schools)) if (s.open) n += classesFor(s.byGrade, classSize, creep).homerooms;
  return n;
}

/** model.autoCuts: how far class sizes creep up when cuts remove `cut` homerooms. */
export function cutCreep(schools: Record<string, SchoolState>, classSize: number, cut: number): number {
  if (cut <= 0) return 0;
  const target = totalHomerooms(schools, classSize, 0) - cut;
  let lo = 0;
  let hi = 40;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (totalHomerooms(schools, classSize, mid) <= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function otherStaff(enrollment: number): number {
  return M.staffSteps.find(([below]) => enrollment < below)![1];
}

export function revenuePerStudent(directCert: number): number {
  return M.revenueBase + M.revenuePoverty * clamp(directCert / M.directCertForMaxWeight, 0, 1);
}

/** State dollars a kid brings at `school`'s poverty weight. */
export function stateWeight(school: SchoolId): number {
  return revenuePerStudent(SCHOOL_INFO.get(school)?.data.pctDirectCert ?? 0);
}

/** State dollars per student at fall 2025's mix of schools. */
export function statePerStudent(): number {
  let kids = 0;
  let dollars = 0;
  for (const s of SCHOOLS) {
    kids += s.enrollment ?? 0;
    dollars += (s.enrollment ?? 0) * revenuePerStudent(s.pctDirectCert ?? 0);
  }
  return dollars / kids;
}

/** Draw key for the state funding card, apart from the household dice. */
const STATE_FUNDING_DRAW = 20;

/** model.stateFunding: the biennium's growth over the last one, from flat to the current service level. */
export function stateFundingGrowth(seedHash: number, biennium: number): number {
  return draw(seedHash, biennium, 0, STATE_FUNDING_DRAW) * (M.stateFundingCeiling / M.stateFunding2025 - 1);
}

/** The Legislature sets the biennium that starts in fall `year` that spring. */
export function legislatureVotes(year: number): boolean {
  return (year - FIRST_YEAR) % 2 === 0;
}

/**
 * State funding for the school year starting in fall `year`, over 2025-27's. The Legislature votes
 * each odd spring on the biennium starting that fall, so a January plan in an odd year assumes flat.
 */
export function stateFundingLevel(seedHash: number, year: number, when: 'january' | 'june'): number {
  let level = 1;
  for (let b = FIRST_YEAR; b <= year; b += 2) if (b < year || when === 'june') level *= 1 + stateFundingGrowth(seedHash, b);
  return level;
}

export function levyRevenue(rate: number): number {
  const r = rate / M.levyRate;
  return (M.levyNet + M.compression) * r - M.compression * r ** M.compressionPower;
}

export function costIndex(year: number): number {
  return (1 + M.costGrowth) ** (year - FIRST_YEAR);
}

export const MEDIAN_SQFT = (() => {
  const s = [...SCHOOL_INFO.values()].map((i) => i.data.squareFeet).filter((x): x is number => x !== null).sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
})();

export interface BudgetInput {
  year: number;
  schools: Record<string, SchoolState>;
  policy: Pick<Policy, 'k5ClassSize' | 'reserveDraw' | 'closures'>;
  /** The levy rate funding this school year, after any vote. */
  levyRate: number;
  /** A levy measure goes to voters this year. */
  election?: boolean;
  reserves: number;
  /** Last year's spending. */
  priorSpending: number;
  cumulativeCuts: number;
  /** The share of cumulativeCuts taken from homerooms. */
  homeroomsCut: number;
  restRevenue: number;
  restCost: number;
  /** State funding over 2025-27's, from stateFundingLevel. */
  stateFunding: number;
  /** Closures in force before this year. */
  closed: ClosedSchool[];
  /** Kids expected to ride a bus this fall only because a zone changed. */
  busRiders?: number;
  /** Busing dollars booked last year, which the state repays this year. */
  busingLastYear?: number;
}

/** model.closureOneTime: the budget books the middle of the range. */
const closureOneTime = () => (M.closureOneTime.lo + M.closureOneTime.hi) / 2;

/** model.closurePhasing: the share of the saving not yet realized `yearsIn` years after a closure. */
function unrealized(yearsIn: number): number {
  return 1 - M.closurePhasing[Math.min(yearsIn, M.closurePhasing.length - 1)];
}

/**
 * The plan for the school year starting in fall `year`. Costs come from the current cohorts at the
 * policy's class size; state revenue comes from the current (prior-year) count.
 */
export function computeBudget(input: BudgetInput): Budget {
  const index = costIndex(input.year);
  const creep = cutCreep(input.schools, input.policy.k5ClassSize, input.homeroomsCut);
  let state = 0;
  let homerooms = 0;
  let staff = 0;
  let plant = 0;
  for (const s of Object.values(input.schools)) {
    const info = SCHOOL_INFO.get(s.id)!;
    state += s.stateRevenue;
    if (!s.open) continue;
    homerooms += classesFor(s.byGrade, input.policy.k5ClassSize, creep).homerooms;
    staff += otherStaff(s.enrollment);
    plant += (info.data.squareFeet ?? MEDIAN_SQFT) * M.plantPerSqft;
  }
  const stateCard = (input.stateFunding - 1) * (state + M.otherStudents * statePerStudent());
  const lines: BudgetLine[] = [
    { key: 'stateK8', label: 'State school fund, K-8', amount: state, sourceKey: 'model.revenuePerStudent' },
    { key: 'stateFunding', label: 'State funding over 2025-27', amount: stateCard, sourceKey: 'model.stateFunding' },
    { key: 'levy', label: 'Local option levy, net', amount: levyRevenue(input.levyRate), sourceKey: 'model.levy' },
    { key: 'restRevenue', label: 'Rest of district revenue', amount: input.restRevenue, sourceKey: 'model.restOfDistrict' },
    { key: 'homerooms', label: 'K-8 homeroom teachers', amount: -homerooms * M.homeroomCost * index, sourceKey: 'model.homerooms' },
    { key: 'staff', label: 'Other school staff', amount: -staff * M.positionCost * index, sourceKey: 'model.staffSteps' },
    { key: 'plant', label: 'Buildings', amount: -plant * index, sourceKey: 'model.plant' },
    { key: 'restCost', label: 'Rest of district costs', amount: -input.restCost * index, sourceKey: 'model.restOfDistrict' },
  ];
  if (input.cumulativeCuts > input.homeroomsCut)
    lines.push({
      key: 'earlierCuts',
      label: 'Positions cut outside homerooms',
      amount: (input.cumulativeCuts - input.homeroomsCut) * M.positionCost * index,
      sourceKey: 'model.autoCuts',
    });
  // Year 1 runs on last fall's schools, so a closure's building is still in the lines above.
  const closed = input.closed.filter((c) => input.year > c.year);
  const closing = effectiveClosures(input.schools, input.policy.closures).length;
  const repaid = busReimbursement(input.busingLastYear ?? 0);
  const oneTime = closing * closureOneTime() * index;
  const optional: [string, string, number, string][] = [
    ['closureOneTime', 'Closures, once', -oneTime, 'model.closureOneTime'],
    [
      'closurePhasing',
      'Closure savings not yet realized',
      -closed.reduce((a, c) => a + unrealized(input.year - c.year) * c.saving, 0) * index,
      'model.closurePhasing',
    ],
    [
      'closureStaff',
      'Staff who followed closed schools',
      -closed.reduce((a, c) => a + c.staffKept, 0) * M.positionCost * index,
      'model.closureSavings',
    ],
    ['busing', 'New bus riders', -busingCost(input.busRiders ?? 0) * index, 'model.busing'],
    ['busReimbursement', "State's busing repayment", repaid, 'model.busReimbursement'],
    ['election', 'Election bill', input.election ? -M.electionBill * index : 0, 'model.electionBill'],
    ['mothball', 'Mothballed buildings', -closed.filter((c) => c.building === 'mothball').length * M.mothball * index, 'model.buildingFate'],
  ];
  for (const [key, label, amount, sourceKey] of optional) if (amount !== 0) lines.push({ key, label, amount, sourceKey });
  const gap = lines.reduce((sum, l) => sum + l.amount, 0);
  const revenue = state + stateCard + levyRevenue(input.levyRate) + input.restRevenue + repaid;
  const position = M.positionCost * index;
  const reserveDraw = clamp(input.policy.reserveDraw, 0, Math.min(input.reserves, Math.max(0, -gap)));
  const oneTimeDraw = Math.max(0, Math.min(M.oneTimeFromReserves * oneTime, input.reserves - reserveDraw, -gap - reserveDraw));
  const autoCutPositions = Math.ceil(Math.max(0, -gap - reserveDraw - oneTimeDraw) / position);
  // model.surplus
  const surplus = Math.max(0, gap);
  const kept = input.reserves - reserveDraw - oneTimeDraw + surplus;
  const before = revenue - gap - autoCutPositions * position;
  // Rehires leave reserves at the policy share of the spending they add to.
  const aboveFloor = Math.max(0, (kept - M.reservePolicy * before) / (1 + M.reservePolicy));
  const rehired = Math.min(input.cumulativeCuts, Math.floor(Math.min(surplus * M.surplusRehire, aboveFloor) / position));
  const spending = before + rehired * position;
  const reservesAfter = kept - rehired * position;
  const floor = M.midYearFloor * spending;
  return {
    lines,
    gap,
    reserveDraw,
    oneTimeDraw,
    autoCutPositions,
    rehired,
    spending,
    reserves: input.reserves,
    reservePct: input.reserves / input.priorSpending,
    reservesAfter,
    reservePctAfterDraw: reservesAfter / spending,
    midYearCuts: reservesAfter < floor ? Math.ceil((floor - reservesAfter) / (position * M.midYearPayShare)) : 0,
  };
}
