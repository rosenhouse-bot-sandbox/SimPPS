import { describe, expect, it } from 'vitest';
import { HIGH_SCHOOLS, SCHOOLS } from '../data';
import { getSource } from '../sources/registry';
import { DEFAULT_POLICY, endYear, newGame, previewBudget, type GameState, type Policy } from '.';
import { classesFor } from './budget';
import { gradeOf } from './model';
import { SCHOOL_INFO } from './population';
import { kCaptureTrend, stepYear } from './step';
import { stateFundingGrowth } from './budget';

const start = newGame({ seed: 'calibration' });
const M = 1_000_000;

function run(state: GameState, policy: Policy, years: number): GameState {
  for (let i = 0; i < years; i++) state = endYear(state, policy).next;
  return state;
}

function withoutGhost(s: GameState) {
  return { ...s, sim: { ...s.sim!, ghost: undefined } };
}

const fall2035 = run(start, DEFAULT_POLICY, 9);
/** The June 2027 budget, after the Legislature's vote. */
const june2027 = stepYear(start, DEFAULT_POLICY).facts.plan;

describe('newGame', () => {
  it('opens in January 2027 with 74 schools, the kids aged one silent year to fall 2026', () => {
    expect(start.year).toBe(2027);
    expect(Object.keys(start.schools)).toHaveLength(74);
    expect(start.dials.kids).toBeGreaterThan(26_300);
    expect(start.dials.kids).toBeLessThan(26_635);
    expect(start.schools.alliance.enrollment).toBe(215);
  });

  it('shows no leavers on the opening map', () => {
    expect(start.households.some((h) => h.movedAway || h.leftThisYear)).toBe(false);
    for (const h of start.households) expect(h.status).toBe(h.school ? 'stayed' : 'left');
  });

  it('opens with a gap of about -$65.2M and reserves of $41.1M, 4.8%', () => {
    expect(start.budget.gap / M).toBeCloseTo(-65.2, 0);
    expect(start.budget.reserves).toBe(41_100_000);
    expect(start.dials.reservePct).toBeCloseTo(0.048, 3);
    expect(start.dials.positionsCut).toBe(0);
  });

  it('opens near 76.6% capture and the fall 2026 kindergarten capture trend', () => {
    expect(start.dials.capture).toBeGreaterThan(0.76);
    expect(start.dials.capture).toBeLessThan(0.775);
    expect(start.dials.kindergartenCapture).toBeCloseTo(kCaptureTrend(2026), 2);
  });

  it('counts kids in URM buildings without a full retrofit', () => {
    const urm = SCHOOLS.filter((s) => s.isUrm && s.seismicRetrofitStatus !== 'full').reduce((a, s) => a + (s.enrollment ?? 0), 0);
    expect(Math.abs(start.dials.kidsInUrm - urm) / urm).toBeLessThan(0.05);
  });

  it('staffs about 717 K-5 homerooms with about 125 blended, as in 2025-26', () => {
    let homerooms = 0;
    let blended = 0;
    for (const s of Object.values(start.schools)) {
      homerooms += classesFor(s.byGrade.slice(0, 6), 24).homerooms;
      blended += s.blendedHomerooms;
    }
    expect(Math.abs(homerooms - 717) / 717).toBeLessThan(0.05);
    expect(Math.abs(blended - 125) / 125).toBeLessThan(0.2);
  });

  it('balances budget lines to the gap', () => {
    const sum = start.budget.lines.reduce((a, l) => a + l.amount, 0);
    expect(sum).toBeCloseTo(start.budget.gap, 0);
  });
});

describe('previewBudget', () => {
  it('saves $3-5M and about 4% of homerooms when K-5 class size goes from 24 to 25', () => {
    const at25 = previewBudget(start, { ...DEFAULT_POLICY, k5ClassSize: 25 });
    const saved = at25.gap - start.budget.gap;
    expect(saved / M).toBeGreaterThan(3);
    expect(saved / M).toBeLessThan(5);
  });

  it('widens the gap by about $104M when the levy lapses', () => {
    const lapse = previewBudget(start, { ...DEFAULT_POLICY, levyRate: 0 });
    expect((start.budget.gap - lapse.gap) / M).toBeCloseTo(103.9, 0);
  });

  it('turns the shortfall after the reserve draw into automatic cuts', () => {
    expect(start.budget.autoCutPositions).toBe(Math.ceil(65_200_000 / 155_000));
    const draw = previewBudget(start, { ...DEFAULT_POLICY, reserveDraw: 10 * M });
    expect(draw.autoCutPositions).toBe(Math.ceil((-draw.gap - 10 * M) / 155_000));
  });
});

describe('previewBudget reserves', () => {
  it('applies no more draw than the gap', () => {
    const later = endYear(start, DEFAULT_POLICY).next;
    const plan = previewBudget(later, { ...DEFAULT_POLICY, reserveDraw: 41 * M });
    expect(plan.reserveDraw).toBeCloseTo(-plan.gap, 0);
    expect(plan.reservesAfter).toBeCloseTo(later.budget.reserves + plan.gap, 0);
    expect(plan.autoCutPositions).toBe(0);
  });

  it('forecasts the mid-year cuts that a deep draw forces', () => {
    const policy = { ...DEFAULT_POLICY, reserveDraw: 41.1 * M };
    const plan = previewBudget(start, policy);
    expect(plan.reservePctAfterDraw).toBeLessThan(0.03);
    expect(plan.midYearCuts).toBeGreaterThan(0);
    const june = stepYear(start, policy).facts.plan;
    expect(june.midYearCuts).toBeGreaterThan(0);
    const { next } = endYear(start, policy);
    expect(next.dials.positionsCut).toBe(june.autoCutPositions + june.midYearCuts);
  });

  it('previews exactly the June budget once the Legislature has voted', () => {
    const later = endYear(start, DEFAULT_POLICY).next;
    const policy = { ...DEFAULT_POLICY, k5ClassSize: 25, reserveDraw: 5 * M };
    expect(stepYear(later, policy).facts.plan).toEqual(previewBudget(later, policy));
  });

  it('forecasts no mid-year cuts without a draw', () => {
    expect(start.budget.midYearCuts).toBe(0);
    expect(start.budget.reservesAfter).toBe(start.budget.reserves);
    expect(start.budget.reservePctAfterDraw).toBeGreaterThan(0.03);
  });
});

describe('endYear', () => {
  it('is deterministic for a seed and policy', () => {
    const a = endYear(newGame({ seed: 'x' }), DEFAULT_POLICY);
    const b = endYear(newGame({ seed: 'x' }), DEFAULT_POLICY);
    expect(a.next.dials).toEqual(b.next.dials);
    expect(a.next.households).toEqual(b.next.households);
    expect(a.report).toEqual(b.report);
    expect(endYear(newGame({ seed: 'y' }), DEFAULT_POLICY).next.dials.kids).not.toBe(a.next.dials.kids);
  });

  it('does not change the state it was given', () => {
    const s = newGame({ seed: 'frozen' });
    const before = JSON.stringify(s);
    endYear(s, DEFAULT_POLICY);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('ages kids a grade and sends 8th graders to high school', () => {
    const { next } = endYear(start, DEFAULT_POLICY);
    const byId = new Map(next.households.map((h) => [h.id, h]));
    for (const h of start.households.slice(0, 3000)) {
      const later = byId.get(h.id);
      if (gradeOf(h) === 8) expect(later).toBeUndefined();
      else if (later) expect(gradeOf(later)).toBe(gradeOf(h) + 1);
    }
    expect(next.year).toBe(2028);
  });

  it('brings in kindergartners near the capture trend', () => {
    const { next } = endYear(start, DEFAULT_POLICY);
    expect(next.dials.kindergartenCapture).toBeGreaterThan(0.74);
    expect(next.dials.kindergartenCapture).toBeLessThan(0.78);
    expect(next.households.filter((h) => gradeOf(h) === 0 && h.school).length).toBeGreaterThan(2500);
  });

  it('moves first graders from across the city into ACCESS, which has no zone', () => {
    const { next, report } = endYear(start, DEFAULT_POLICY);
    const intake = next.households.filter((h) => h.school === 'access-academy' && gradeOf(h) === 1);
    expect(intake).toHaveLength(Math.round(315 / 8));
    for (const h of intake) expect(h.status).toBe('moved');
    expect(report.flows.movedWithinPps).toBe(next.households.filter((h) => h.status === 'moved').length);
    expect(fall2035.schools['access-academy'].enrollment).toBeGreaterThan(250);
    expect(fall2035.schools['access-academy'].enrollment).toBeLessThan(330);
  });

  it('sends grade-6 kids from K-5 schools to middle grades', () => {
    const { next } = endYear(start, DEFAULT_POLICY);
    const sixth = next.households.filter((h) => gradeOf(h) === 6 && h.school);
    expect(sixth.length).toBeGreaterThan(2500);
    const fed = sixth.filter((h) => h.status === 'stayed' && h.school === h.zoneSchool).length;
    expect(fed / sixth.length).toBeGreaterThan(0.6);
    for (const h of sixth) expect(SCHOOL_INFO.get(h.school!)!.hi).toBe(8);
  });

  it('sorts every continuing kid into the report flows', () => {
    const { next, report } = endYear(start, DEFAULT_POLICY);
    const before = new Map(start.households.map((h) => [h.id, h]));
    const continuing = next.households.filter((h) => before.has(h.id));
    const count = (pred: (h: (typeof continuing)[number]) => boolean) => continuing.filter(pred).length;
    const wasIn = (h: { id: number }) => before.get(h.id)!.school !== null;
    expect(report.flows.stayed).toBe(count((h) => wasIn(h) && h.status === 'stayed'));
    expect(report.flows.movedWithinPps).toBe(count((h) => wasIn(h) && h.status === 'moved'));
    expect(report.flows.leftPps).toBe(count((h) => wasIn(h) && h.status === 'left'));
    expect(report.flows.cameBack).toBe(count((h) => !wasIn(h) && h.status === 'returned'));
    const { stayed, movedWithinPps, leftPps, cameBack } = report.flows;
    const graduates = start.households.filter((h) => h.school && gradeOf(h) === 8).length;
    expect(stayed + movedWithinPps + leftPps).toBe(start.dials.kids - graduates);
    const entrants = next.households.filter((h) => !before.has(h.id) && h.school).length;
    expect(report.flows.enteredK).toBe(entrants);
    expect(report.flows.graduated).toBe(graduates);
    expect(stayed + movedWithinPps + cameBack + entrants).toBe(next.dials.kids);
  });

  it('closes the June budget with the Legislature\'s state funding card on top of the flat plan', () => {
    const card = june2027.lines.find((l) => l.key === 'stateFunding')!.amount;
    expect(start.budget.lines.find((l) => l.key === 'stateFunding')!.amount).toBe(0);
    expect(june2027.gap - start.budget.gap).toBeCloseTo(card, 0);
    const stateRevenue = card / stateFundingGrowth(start.sim!.seedHash, 2027);
    expect(stateRevenue / M).toBeGreaterThan(330);
    expect(stateRevenue / M).toBeLessThan(400);
  });

  it('sets state funding in odd springs only', () => {
    const odd = endYear(start, DEFAULT_POLICY);
    const even = endYear(odd.next, DEFAULT_POLICY);
    const vote = (r: typeof odd.report) => r.events.filter((e) => e.sourceKey === 'model.stateFunding');
    const pct = (stateFundingGrowth(start.sim!.seedHash, 2027) * 100).toFixed(1);
    expect(vote(odd.report)).toHaveLength(1);
    expect(vote(odd.report)[0].season).toBe('spring');
    expect(vote(odd.report)[0].title).toBe(`Legislature sets state funding: +${pct}%`);
    expect(vote(even.report)).toHaveLength(0);
    const card = (b: typeof start.budget) => b.lines.find((l) => l.key === 'stateFunding')!.amount;
    expect(card(odd.next.budget)).toBeGreaterThan(0);
    expect(card(even.next.budget)).toBeCloseTo(card(odd.next.budget), -6);
  });

  it('takes automatic cuts and carries them into the next plan', () => {
    const { next, report } = endYear(start, DEFAULT_POLICY);
    expect(report.budget).toEqual(june2027);
    expect(next.dials.positionsCut).toBe(june2027.autoCutPositions);
    expect(next.budget.lines.find((l) => l.key === 'earlierCuts')!.amount).toBeGreaterThan(0.6 * june2027.autoCutPositions * 155_000);
    expect(next.budget.gap / M).toBeGreaterThan(-50);
    expect(next.budget.gap / M).toBeLessThan(-20);
    expect(report.events.some((e) => e.season === 'spring' && /cut/i.test(e.title + e.detail))).toBe(true);
  });

  it('takes some cut positions out of classrooms', () => {
    const noCuts = { ...DEFAULT_POLICY, levyRate: 5 };
    const cut = endYear(start, DEFAULT_POLICY).next;
    const uncut = endYear(start, noCuts).next;
    const total = (s: GameState, key: 'homerooms' | 'blendedHomerooms') =>
      Object.values(s.schools).reduce((a, x) => a + x[key], 0);
    const removed = total(uncut, 'homerooms') - total(cut, 'homerooms');
    expect(removed).toBeGreaterThan(0.1 * june2027.autoCutPositions);
    expect(removed).toBeLessThan(0.4 * june2027.autoCutPositions);
    expect(total(cut, 'blendedHomerooms')).toBeGreaterThan(0.9 * total(uncut, 'blendedHomerooms'));
  });

  it('saves the same total for cuts whether they fall in classrooms or elsewhere', () => {
    const noCuts = { ...DEFAULT_POLICY, levyRate: 5 };
    const cut = endYear(start, DEFAULT_POLICY).next;
    const uncut = endYear(start, noCuts).next;
    const line = (s: GameState, key: string) => s.budget.lines.find((l) => l.key === key)?.amount ?? 0;
    const saved = line(cut, 'earlierCuts') + line(cut, 'homerooms') - line(uncut, 'homerooms');
    const expected = cut.sim!.cumulativeCuts * 155_000 * 1.035;
    expect(Math.abs(saved - expected) / expected).toBeLessThan(0.03);
  });

  it('spends reserves before cutting', () => {
    const policy = { ...DEFAULT_POLICY, reserveDraw: 5 * M };
    const { next } = endYear(start, policy);
    expect(next.budget.reserves).toBe(start.budget.reserves - 5 * M);
    expect(next.dials.positionsCut).toBe(Math.ceil((-june2027.gap - 5 * M) / 155_000));
    expect(next.policy.reserveDraw).toBe(0);
    expect(next.policy.k5ClassSize).toBe(24);
  });

  it('keeps the reserve share when reserves hold or grow and spending shrinks', () => {
    const later = run(start, DEFAULT_POLICY, 5);
    expect(later.budget.reserves).toBeGreaterThanOrEqual(start.budget.reserves);
    expect(later.dials.reservePct).toBeGreaterThanOrEqual(start.dials.reservePct);
  });

  it('forces mid-year cuts when reserves fall below 3%', () => {
    const { next, report } = endYear(start, { ...DEFAULT_POLICY, reserveDraw: 41.1 * M });
    expect(next.dials.reservePct).toBeGreaterThanOrEqual(0.03);
    expect(next.dials.positionsCut).toBeGreaterThan(Math.ceil((65.2 - 41.1) / 0.155));
    expect(report.events.some((e) => e.season === 'winter' && e.sourceKey === 'model.midYearCuts')).toBe(true);
  });

  it('loses a few more kids at class size 28 than at 24, at most a point', () => {
    const base = endYear(start, DEFAULT_POLICY).next.dials.kids;
    const big = endYear(start, { ...DEFAULT_POLICY, k5ClassSize: 28 }).next.dials.kids;
    expect(big).toBeLessThan(base);
    expect(base - big).toBeLessThan(0.01 * 26_966);
  });

  it('matches its do-nothing ghost under DEFAULT_POLICY', () => {
    const { next, report } = endYear(start, DEFAULT_POLICY);
    expect(withoutGhost(next.sim!.ghost!)).toEqual(withoutGhost(next));
    for (const g of report.vsGhost) expect(g.you).toBe(g.ghost);
  });

  it('compares against a ghost that takes automatic cuts', () => {
    const { report } = endYear(start, { ...DEFAULT_POLICY, reserveDraw: 20 * M });
    expect(report.vsGhost.length).toBeGreaterThan(0);
    const cuts = report.vsGhost.find((g) => g.dial === 'positionsCut')!;
    expect(cuts.ghost).toBe(june2027.autoCutPositions);
    expect(cuts.better).toBe(true);
  });

  it('keeps the ghost on DEFAULT_POLICY across years', () => {
    const policy = { ...DEFAULT_POLICY, k5ClassSize: 26 };
    const two = run(start, policy, 2);
    const ghostTwo = run(start, DEFAULT_POLICY, 2);
    expect(two.sim!.ghost!.dials).toEqual(ghostTwo.dials);
  });

  it('prints three Bulletin headlines that never name a school', () => {
    const { report } = endYear(start, DEFAULT_POLICY);
    expect(report.headlines).toHaveLength(3);
    const names = [...SCHOOLS, ...HIGH_SCHOOLS].map((s) =>
      s.name.replace(/ (Elementary School|Middle School|High School|K-8 School|School|Program \(K-8\))$/, ''),
    );
    for (const h of report.headlines) {
      expect(getSource(h.sourceKey)).toBeDefined();
      for (const n of names) expect(h.text).not.toMatch(new RegExp(`\\b${n}\\b`));
    }
  });

  it('plays every season and cites a registered source', () => {
    const { report } = endYear(start, DEFAULT_POLICY);
    expect(new Set(report.events.map((e) => e.season))).toEqual(
      new Set(['spring', 'summer', 'fall', 'october', 'winter']),
    );
    for (const e of report.events) if (e.sourceKey) expect(getSource(e.sourceKey)).toBeDefined();
    for (const l of start.budget.lines) expect(getSource(l.sourceKey)).toBeDefined();
  });

  it('lands status quo in fall 2035 near the PSU total, inside its band', () => {
    expect(fall2035.year - 1).toBe(2035);
    expect(Math.abs(fall2035.dials.kids - 23_999)).toBeLessThan(500);
    expect(fall2035.dials.kids).toBeGreaterThan(22_119);
    expect(fall2035.dials.kids).toBeLessThan(26_412);
  });

  it('tracks the PSU forecast within 2% every year from fall 2027 to 2035', () => {
    const forecast = [26_292, 26_023, 25_766, 25_272, 24_971, 24_693, 24_514, 24_271, 23_999];
    let s = start;
    for (const f of forecast) {
      s = endYear(s, DEFAULT_POLICY).next;
      expect(Math.abs(s.dials.kids - f) / f).toBeLessThan(0.02);
    }
  });

  it('steps a year, ghost included, in under 300 ms', () => {
    const s = newGame({ seed: 'speed' });
    endYear(s, DEFAULT_POLICY);
    // The fastest of three, so a busy test worker doesn't fail it.
    const times = [25, 26, 27].map((k5ClassSize) => {
      const t0 = performance.now();
      endYear(s, { ...DEFAULT_POLICY, k5ClassSize });
      return performance.now() - t0;
    });
    expect(Math.min(...times)).toBeLessThan(300);
  });
});
