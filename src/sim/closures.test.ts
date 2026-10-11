import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, endYear, modeledRange, newGame } from '.';
import { computeBudget, costIndex, revenuePerStudent } from './budget';
import {
  closureChip,
  closureOutcomes,
  closureSaving,
  followChance,
  nonFollowerChoice,
  normalizeClosures,
  type FollowFactors,
} from './closures';
import { buildSchools } from './schools';
import { familiesDecide } from './step';
import type { ClosedSchool, Closure, GameState, SchoolState } from './types';

const none: FollowFactors = {
  miles: 0.5,
  barrier: false,
  riskier: false,
  movedBefore: false,
  loyalty: 0,
  exitCapacity: 0,
  wholeClasses: false,
};

describe('followChance', () => {
  it('starts from the card and adjusts by the design table', () => {
    expect(followChance(0.88, none)).toBeCloseTo(0.88);
    expect(followChance(0.88, { ...none, miles: 3 })).toBeCloseTo(0.82);
    expect(followChance(0.88, { ...none, barrier: true })).toBeCloseTo(0.84);
    expect(followChance(0.88, { ...none, riskier: true })).toBeCloseTo(0.85);
    expect(followChance(0.88, { ...none, movedBefore: true })).toBeCloseTo(0.8);
    expect(followChance(0.88, { ...none, loyalty: 1 })).toBeCloseTo(0.83);
    expect(followChance(0.88, { ...none, loyalty: 0.4 })).toBeCloseTo(0.86);
    expect(followChance(0.88, { ...none, exitCapacity: 1 })).toBeCloseTo(0.84);
    expect(followChance(0.88, { ...none, wholeClasses: true })).toBeCloseTo(0.91);
  });

  it('stays a probability', () => {
    expect(followChance(0.99, { ...none, wholeClasses: true })).toBe(1);
    expect(followChance(0.65, { ...none, miles: 30 })).toBe(0);
  });
});

describe('nonFollowerChoice', () => {
  it('splits 35% other PPS, 10% charter and 55% leave PPS', () => {
    const n = 1000;
    const tally = { otherPps: 0, charter: 0, left: 0 };
    for (let i = 0; i < n; i++) tally[nonFollowerChoice((i + 0.5) / n)]++;
    expect(tally).toEqual({ otherPps: 350, charter: 100, left: 550 });
  });
});

describe('normalizeClosures', () => {
  it('keeps 1-2 receivers with shares that sum to 1', () => {
    const [c] = normalizeClosures([
      {
        school: 'maplewood',
        receivers: [
          { school: 'hayhurst', share: 7 },
          { school: 'rieke', share: 3 },
          { school: 'markham', share: 1 },
        ],
        building: 'mothball',
      },
    ]);
    expect(c.receivers).toEqual([
      { school: 'hayhurst', share: 0.7 },
      { school: 'rieke', share: 0.3 },
    ]);
  });

  it('drops a closure of a school with no K-8 kids', () => {
    expect(normalizeClosures([{ school: 'alliance', receivers: [{ school: 'lent', share: 1 }], building: 'sell' }])).toEqual([]);
  });

  it('drops a receiver that closes too, a duplicate closure and a closure with no receiver', () => {
    const out = normalizeClosures([
      { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 0 }, { school: 'woodmere', share: 0 }], building: 'sell' },
      { school: 'woodmere', receivers: [{ school: 'whitman', share: 1 }], building: 'mothball' },
      { school: 'woodmere', receivers: [{ school: 'lent', share: 1 }], building: 'mothball' },
      { school: 'sabin', receivers: [{ school: 'sabin', share: 1 }], building: 'mothball' },
    ]);
    expect(out.map((c) => c.school)).toEqual(['peninsula', 'woodmere']);
    expect(out[0].receivers).toEqual([{ school: 'rosa-parks', share: 1 }]);
    expect(out[1].receivers[0].school).toBe('whitman');
  });
});

describe('closure budget lines', () => {
  const school = (id: string, open = true): SchoolState => ({
    id,
    open,
    enrollment: 0,
    byGrade: new Array(9).fill(0),
    capacity: 500,
    homerooms: 0,
    blendedHomerooms: 0,
  });
  const base = {
    year: 2027,
    schools: { peninsula: school('peninsula'), 'rosa-parks': school('rosa-parks') },
    policy: { k5ClassSize: 24, levyRate: 0, reserveDraw: 0, closures: [] },
    reserves: 0,
    priorSpending: 800_000_000,
    cumulativeCuts: 0,
    homeroomsCut: 0,
    restRevenue: 0,
    restCost: 0,
    stateFunding: 1,
  };
  const amount = (b: ReturnType<typeof computeBudget>, key: string) => b.lines.find((l) => l.key === key)?.amount ?? 0;
  const closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const };
  const closed = (year: number, building: ClosedSchool['building'] = 'mothball'): ClosedSchool => ({
    ...closure,
    building,
    year,
    saving: 1_000_000,
    staffKept: 4,
  });
  const after = { ...base.schools, peninsula: school('peninsula', false) };

  it('charges the one-time cost in the year played', () => {
    const b = computeBudget({ ...base, policy: { ...base.policy, closures: [closure] } });
    expect(amount(b, 'closureOneTime')).toBeCloseTo(-450_000, 0);
    expect(amount(computeBudget(base), 'closureOneTime')).toBe(0);
  });

  it('gives back half the saving in the second year and none from the third', () => {
    const year2 = computeBudget({ ...base, year: 2028, schools: after, closed: [closed(2027)] });
    expect(amount(year2, 'closurePhasing')).toBeCloseTo(-500_000 * costIndex(2028), 0);
    const year3 = computeBudget({ ...base, year: 2029, schools: after, closed: [closed(2027)] });
    expect(amount(year3, 'closurePhasing')).toBe(0);
  });

  it('keeps paying the staff who followed the kids', () => {
    const b = computeBudget({ ...base, year: 2029, schools: after, closed: [closed(2027)] });
    expect(amount(b, 'closureStaff')).toBeCloseTo(-4 * 155_000 * costIndex(2029), 0);
  });

  it('leaves this year\'s closures to the one-time line', () => {
    const b = computeBudget({ ...base, year: 2027, closed: [closed(2027)] });
    for (const key of ['closurePhasing', 'closureStaff', 'mothball']) expect(amount(b, key)).toBe(0);
  });

  it('costs $70K a year for a mothballed building and nothing for a leased or sold one', () => {
    const b = computeBudget({ ...base, year: 2029, schools: after, closed: [closed(2027)] });
    expect(amount(b, 'mothball')).toBeCloseTo(-70_000 * costIndex(2029), 0);
    for (const fate of ['lease', 'sell'] as const)
      expect(amount(computeBudget({ ...base, year: 2029, schools: after, closed: [closed(2027, fate)] }), 'mothball')).toBe(0);
  });
});

describe('closureChip', () => {
  const game = newGame({ seed: 'chip' });
  const peninsula: Closure = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' };
  const chip = closureChip(game, peninsula);
  const net = (closureSaving(game.schools, peninsula, 24) - 70_000) * costIndex(2029);

  it('counts seats if all follow: Peninsula into Rosa Parks', () => {
    expect(chip.seats.capacity).toBe(594);
    expect(chip.seats.kids).toBe(game.schools.peninsula.enrollment + game.schools['rosa-parks'].enrollment);
    expect(Math.abs(chip.seats.kids - 399)).toBeLessThan(30);
  });

  it('counts the kids who must choose: those still in the school\'s grades next fall', () => {
    const fifth = game.households.filter((h) => h.school === 'peninsula' && h.kids[5]).length;
    expect(chip.kidsMoving).toBe(game.schools.peninsula.enrollment - fifth);
  });

  it('adds about half a mile of walk', () => {
    expect(chip.walkMiles).toBeGreaterThan(0.2);
    expect(chip.walkMiles).toBeLessThan(0.9);
  });

  it('costs the one-time range now and saves the net at maturity in fall 2029', () => {
    expect(chip.now).toEqual({ lo: -600_000, hi: -300_000 });
    expect(chip.maturesIn).toBe(2029);
    expect((chip.atMaturity.lo + chip.atMaturity.hi) / 2).toBeCloseTo(net, 0);
    expect(chip.atMaturity.hi / chip.atMaturity.lo).toBeCloseTo(1.15 / 0.85, 5);
    expect(chip.atMaturity.lo).toBeGreaterThan(300_000);
    expect(chip.atMaturity.hi).toBeLessThan(1_500_000);
    const lease = closureChip(game, { ...peninsula, building: 'lease' });
    expect((lease.atMaturity.lo + lease.atMaturity.hi) / 2 - net).toBeCloseTo(70_000 * costIndex(2029), 0);
  });

  it('pays off if fewer leave PPS than the saving buys in revenue', () => {
    expect(chip.paysOffIfFewerThan).toBe(Math.floor(net / revenuePerStudent(0.2)));
  });

  it('saves $0.3-1.5M gross at each PPS Scenario A closure', () => {
    const a = newGame({ seed: 'chip', start: 'scenario-a' });
    expect(a.policy.closures).toHaveLength(14);
    for (const c of a.policy.closures) {
      const s = closureSaving(a.schools, c, 24);
      expect(s, c.school).toBeGreaterThan(300_000);
      expect(s, c.school).toBeLessThan(1_500_000);
    }
  });
});

describe('Close & send over the years', () => {
  const start = newGame({ seed: 'close' });
  const peninsula: Closure = {
    school: 'peninsula',
    receivers: [{ school: 'rosa-parks', share: 1 }],
    building: 'mothball',
    guess: 200,
  };
  const policy = { ...DEFAULT_POLICY, closures: [peninsula] };
  const { next, report } = endYear(start, policy);
  const quo = endYear(start, DEFAULT_POLICY).next;
  const movers = next.households.filter((h) => h.movedFrom === 'peninsula');
  const [outcome] = report.closures;
  const mid = (r: { lo: number; hi: number }) => (r.lo + r.hi) / 2;

  it('empties the closed school by fall and grows the receiver', () => {
    expect(next.schools.peninsula.enrollment).toBe(0);
    expect(next.schools.peninsula.open).toBe(false);
    expect(next.schools.peninsula.closed).toEqual({ year: 2027, building: 'mothball' });
    expect(next.schools['rosa-parks'].enrollment).toBeGreaterThan(quo.schools['rosa-parks'].enrollment + 150);
    expect(next.schools['rosa-parks'].homerooms).toBeGreaterThan(quo.schools['rosa-parks'].homerooms);
    expect(next.policy.closures).toEqual([]);
  });

  it('sorts movers into the year\'s flows', () => {
    const { stayed, movedWithinPps, cameBack, enteredK } = report.flows;
    expect(stayed + movedWithinPps + cameBack + enteredK).toBe(next.dials.kids);
    expect(movedWithinPps).toBe(next.households.filter((h) => h.status === 'moved').length);
  });

  it('moves every kid still in its grades and marks them for trails', () => {
    expect(movers.length).toBe(closureChip(start, peninsula).kidsMoving);
    expect(outcome.kids).toBe(movers.length);
    for (const h of movers) {
      expect(h.forcedMoves).toBe(1);
      expect(h.status === 'moved' || h.leftThisYear).toBe(true);
    }
  });

  it('reports where the kids went as ranges', () => {
    const at = (school: string | null) => movers.filter((h) => h.school === school).length;
    const left = movers.filter((h) => h.school === null).length;
    expect(outcome.receivers).toEqual([{ school: 'rosa-parks', kids: modeledRange(at('rosa-parks')) }]);
    expect(outcome.leftPps).toEqual(modeledRange(left));
    expect(outcome.otherPps).toEqual(modeledRange(movers.length - left - at('rosa-parks')));
    expect(at('rosa-parks') / movers.length).toBeGreaterThan(0.5);
  });

  it('scores the "Call it" guess against kids who stayed in PPS', () => {
    const stayed = movers.filter((h) => h.school !== null).length;
    expect(outcome.guess).toEqual({
      stayInPps: 200,
      actual: modeledRange(stayed),
      hit: 200 >= modeledRange(stayed).lo && 200 <= modeledRange(stayed).hi,
    });
    const tally = { school: 'peninsula', kids: 200, receivers: { 'rosa-parks': 150 }, otherPps: 10, left: 40 };
    const closed = { ...peninsula, year: 2027, saving: 0, staffKept: 0 };
    const score = (guess?: number) => closureOutcomes([tally], [{ ...closed, guess }])[0].guess;
    expect(score(160)!.hit).toBe(true);
    expect(score(modeledRange(160).hi + 1)!.hit).toBe(false);
    expect(score(modeledRange(160).lo - 1)!.hit).toBe(false);
    expect(score(undefined)).toBeUndefined();
  });

  it('counts movers who stayed without a choice at the school\'s direct-certification share', () => {
    const stayed = movers.filter((h) => h.school !== null).length;
    expect(outcome.stayedWithoutChoice).toBeCloseTo(stayed * 0.2);
  });

  it('re-zones the closed zone so its kindergartners enter the receiver', () => {
    expect(next.households.some((h) => h.zoneSchool === 'peninsula')).toBe(false);
    const k = next.households.filter((h) => h.kids[0] && h.school === 'rosa-parks').length;
    const kQuo = quo.households.filter((h) => h.kids[0] && h.school === 'rosa-parks').length;
    expect(k).toBeGreaterThan(kQuo + 15);
    const later = endYear(next, DEFAULT_POLICY).next;
    expect(later.schools.peninsula.enrollment).toBe(0);
    expect(later.schools.peninsula.open).toBe(false);
  });

  it('books 0% of the saving in year 1, 50% in year 2 and 100% from year 3', () => {
    const line = (b: typeof start.budget, key: string) => b.lines.find((l) => l.key === key)?.amount ?? 0;
    expect(line(report.budget, 'closureOneTime')).toBeCloseTo(-450_000, 0);
    const saving = next.sim!.closed[0].saving;
    expect(line(next.budget, 'closurePhasing')).toBeCloseTo(-0.5 * saving * costIndex(2028), 0);
    expect(line(next.budget, 'mothball')).toBeCloseTo(-70_000 * costIndex(2028), 0);
    const year3 = endYear(next, DEFAULT_POLICY).next.budget;
    expect(line(year3, 'closurePhasing')).toBe(0);
    expect(line(year3, 'mothball')).toBeLessThan(0);
  });

  it('saves about what the chip promised once mature, if revenue is set aside', () => {
    const atMaturity = closureChip(start, peninsula).atMaturity;
    const noCuts = { ...DEFAULT_POLICY, levyRate: 5 };
    const play = (p: typeof policy) => [p, noCuts, noCuts].reduce((s, x) => endYear(s, x).next, start);
    const y3 = play({ ...noCuts, closures: [peninsula] });
    const q3 = play(noCuts);
    const cost = (b: typeof start.budget) => b.lines.filter((l) => l.amount < 0 && l.key !== 'restCost').reduce((a, l) => a + l.amount, 0);
    const saved = cost(y3.budget) - cost(q3.budget);
    expect(saved).toBeGreaterThan(0.8 * mid(atMaturity));
    expect(saved).toBeLessThan(1.2 * mid(atMaturity));
  });

  it('is deterministic', () => {
    const again = endYear(newGame({ seed: 'close' }), policy);
    expect(again.next.households).toEqual(next.households);
    expect(again.report).toEqual(report);
  });

  it('leaves the ghost unchanged', () => {
    const strip = (s: GameState) => ({ ...s, sim: { ...s.sim!, ghost: undefined } });
    expect(strip(next.sim!.ghost!)).toEqual(strip(endYear(start, DEFAULT_POLICY).next.sim!.ghost!));
    const a = endYear(newGame({ seed: 'close', start: 'scenario-a' }), newGame({ seed: 'close', start: 'scenario-a' }).policy);
    expect(strip(a.next.sim!.ghost!)).toEqual(strip(quo));
  });

  it('sends crowding past 110% of seats to decide again', () => {
    const small: Closure = { school: 'forest-park', receivers: [{ school: 'skyline', share: 1 }], building: 'sell' };
    const crowded = endYear(start, { ...DEFAULT_POLICY, closures: [small] }).next;
    expect(crowded.schools.skyline.enrollment).toBeLessThanOrEqual(Math.floor(1.1 * 282));
    expect(start.schools.skyline.enrollment + closureChip(start, small).kidsMoving * 0.6).toBeGreaterThan(1.1 * 282);
  });
});

describe('Scenario A over a year', () => {
  const start = newGame({ seed: 'scenario', start: 'scenario-a' });
  const { next, report } = endYear(start, start.policy);
  const movers = next.households.filter((h) => h.movedFrom);

  it('closes 14 schools and empties them', () => {
    expect(report.closures).toHaveLength(14);
    for (const c of report.closures) expect(next.schools[c.school].enrollment).toBe(0);
  });

  it('splits kids who do not follow about 35/10/55 and follows the card on average', () => {
    const notToReceiver = movers.filter((h) => {
      const c = start.policy.closures.find((x) => x.school === h.movedFrom)!;
      return !c.receivers.some((r) => r.school === h.school);
    });
    const otherPps = notToReceiver.filter((h) => h.school !== null).length / notToReceiver.length;
    expect(otherPps).toBeGreaterThan(0.25);
    expect(otherPps).toBeLessThan(0.5);
    const follow = 1 - notToReceiver.length / movers.length;
    expect(follow).toBeLessThan(start.sim!.cards.followRate + 0.05);
    expect(follow).toBeGreaterThan(start.sim!.cards.followRate - 0.2);
  });
});

describe("a closed zone's kindergarten capture", () => {
  it('falls by the hidden card', () => {
    const start = newGame({ seed: 'zone' });
    const closed: ClosedSchool = {
      school: 'peninsula',
      receivers: [{ school: 'rosa-parks', share: 1 }],
      building: 'mothball',
      year: 2027,
      saving: 0,
      staffKept: 0,
    };
    const joined = (drop: number) =>
      familiesDecide(start.sim!, start.households, 2027, 24, 0, {
        closed: [closed],
        cards: { followRate: 0.9, closedZoneCaptureDrop: drop },
      }).households.filter((h) => h.kids[0] && h.zoneSchool === 'rosa-parks' && h.school !== null).length;
    expect(joined(0.5)).toBeLessThan(0.75 * joined(0));
  });
});

describe('buildSchools', () => {
  it('marks closed schools and sends their high schoolers out of the count', () => {
    const mlc: ClosedSchool = {
      school: 'metropolitan-learning-center',
      receivers: [{ school: 'chapman', share: 1 }],
      building: 'lease',
      year: 2027,
      saving: 0,
      staffKept: 0,
    };
    const schools = buildSchools([], 24, 0, [mlc]);
    expect(schools['metropolitan-learning-center']).toMatchObject({ open: false, enrollment: 0, closed: { year: 2027, building: 'lease' } });
    expect(buildSchools([], 24)['metropolitan-learning-center'].enrollment).toBeGreaterThan(0);
  });
});
