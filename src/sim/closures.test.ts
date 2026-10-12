import { describe, expect, it } from 'vitest';
import { richLevy } from './fixtures';
import { DEFAULT_POLICY, endYear, modeledRange, newGame } from '.';
import { computeBudget, costIndex, otherStaff, revenuePerStudent } from './budget';
import {
  canClose,
  closureChip,
  closureOutcomes,
  closureSaving,
  closuresTakingEffect,
  decideClosures,
  followChance,
  followFactors,
  isRiskier,
  nearestOpen,
  nonFollowerChoice,
  normalizeClosures,
  receiverCandidates,
  receiversFor,
  schoolFollowOffset,
  withArrivals,
  type FollowFactors,
  type Mover,
} from './closures';
import { gradeOf, M, METERS_PER_MILE, oneKid, setModelParams } from './model';
import { SCHOOL_INFO } from './population';
import { buildSchools } from './schools';
import { familiesDecide } from './step';
import type { ClosedSchool, Closure, Flows, GameState, Household, SchoolState } from './types';

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
    stateRevenue: 0,
    homerooms: 0,
    k5Homerooms: 0,
    blendedHomerooms: 0,
  });
  const base = {
    year: 2027,
    schools: { peninsula: school('peninsula'), 'rosa-parks': school('rosa-parks') },
    policy: { k5ClassSize: 24, reserveDraw: 0, closures: [] },
    levyRate: 0,
    reserves: 0,
    priorSpending: 800_000_000,
    cumulativeCuts: 0,
    homeroomsCut: 0,
    restRevenue: 0,
    restCost: 0,
    stateFunding: 1,
    closed: [],
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

  it('draws the oneTimeFromReserves share of the one-time cost from reserves instead of cutting', () => {
    const input = { ...base, reserves: 10_000_000, restRevenue: -5_000_000, policy: { ...base.policy, closures: [closure] } };
    const cut = computeBudget(input);
    setModelParams({ oneTimeFromReserves: 1 });
    const drawn = computeBudget(input);
    expect(drawn.oneTimeDraw).toBeCloseTo(450_000, 0);
    expect(drawn.reservesAfter).toBeCloseTo(cut.reservesAfter - 450_000, 0);
    expect(drawn.autoCutPositions).toBe(Math.ceil((-cut.gap - 450_000) / 155_000));
    expect(drawn.autoCutPositions).toBeLessThan(cut.autoCutPositions);
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
  const chip = closureChip(game, peninsula, [], 24);
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
    const lease = closureChip(game, { ...peninsula, building: 'lease' }, [], 24);
    expect((lease.atMaturity.lo + lease.atMaturity.hi) / 2 - net).toBeCloseTo(70_000 * costIndex(2029), 0);
  });

  it('charges new bus riders now and, net of the repayment, at maturity', () => {
    const bused = closureChip(game, peninsula, [], 24, 10);
    expect(bused.busRiders).toBe(10);
    expect(chip.busRiders).toBe(0);
    expect(bused.now).toEqual({ lo: -600_000 - 18_000, hi: -300_000 - 10_000 });
    expect(bused.atMaturity.lo).toBeCloseTo(chip.atMaturity.lo - 10 * 1_800 * 0.3 * costIndex(2029));
    expect(bused.atMaturity.hi).toBeCloseTo(chip.atMaturity.hi - 10 * 1_000 * 0.1 * costIndex(2029));
    expect(bused.paysOffIfFewerThan).toBe(Math.floor((net - 10 * 1_400 * 0.2 * costIndex(2029)) / revenuePerStudent(0.2)));
  });

  it('pays off if fewer leave PPS than the saving buys in revenue', () => {
    expect(chip.paysOffIfFewerThan).toBe(Math.floor(net / revenuePerStudent(0.2)));
  });

  it('saves $0.5-1.8M gross at each PPS Scenario A closure and within PPS\'s $5-20M in all', () => {
    const a = newGame({ seed: 'chip', start: 'scenario-a' });
    expect(a.policy.closures).toHaveLength(14);
    let total = 0;
    for (const c of a.policy.closures) {
      const s = closureSaving(a.schools, c, 24);
      expect(s, c.school).toBeGreaterThan(500_000);
      expect(s, c.school).toBeLessThan(1_800_000);
      total += s;
    }
    expect(total).toBeGreaterThan(5e6);
    expect(total).toBeLessThan(20e6);
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

  it('adds followShift to every kid\'s chance to follow', () => {
    const followers = (next: GameState) => next.households.filter((h) => h.movedFrom === 'peninsula' && h.school === 'rosa-parks').length;
    const shifted = endYear(newGame({ seed: 'close', model: { followShift: 0.2 } }), policy).next;
    expect(followers(shifted)).toBeGreaterThan(followers(next) + 15);
  });

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
    expect(movers.length).toBe(closureChip(start, peninsula, [], 24).kidsMoving);
    expect(outcome.kids).toEqual(modeledRange(movers.length));
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
    const atMaturity = closureChip(start, peninsula, [], 24).atMaturity;
    const noCuts = { ...DEFAULT_POLICY, levyRate: 5 };
    const play = (p: typeof policy) => [p, noCuts, noCuts].reduce((s, x) => endYear(s, x).next, richLevy(start));
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

  it('keeps a crowded receiver at 110% of its seats', () => {
    const small: Closure = { school: 'forest-park', receivers: [{ school: 'skyline', share: 1 }], building: 'sell' };
    const crowded = endYear(start, { ...DEFAULT_POLICY, closures: [small] }).next;
    expect(crowded.schools.skyline.enrollment).toBeLessThanOrEqual(Math.floor(1.1 * 282));
    expect(start.schools.skyline.enrollment + closureChip(start, small, [], 24).kidsMoving * 0.6).toBeGreaterThan(1.1 * 282);
  });
});

describe('Scenario A over a year', () => {
  const start = newGame({ seed: 'scenario', start: 'scenario-a' });
  const { next, report } = endYear(start, start.policy);
  const closing = new Set(start.policy.closures.map((c) => c.school));
  // Program followers keep their program; a closure's movers never have one.
  const followedProgram = (h: Household) => h.program !== undefined;
  const movers = next.households.filter((h) => h.movedFrom && closing.has(h.movedFrom) && !followedProgram(h));

  it('sends each follower who lives in the closed zone to the receiver its block went to', () => {
    const before = new Map(start.households.map((h) => [h.id, h]));
    const closures = new Map(start.policy.closures.map((c) => [c.school, c]));
    const followers = movers.filter((h) => {
      const c = closures.get(h.movedFrom!);
      return c && before.get(h.id)!.zoneSchool === c.school && c.receivers.some((r) => r.school === h.school);
    });
    expect(followers.length).toBeGreaterThan(1000);
    // A full zone school sends some on: Hosford fills first with Sunnyside's grades 6-8.
    const full = (id: string) => next.schools[id].enrollment >= Math.floor(M.crowdingLine * next.schools[id].capacity);
    expect(followers.filter((h) => h.school !== h.zoneSchool && !full(h.zoneSchool))).toEqual([]);
    expect(full('hosford')).toBe(true);
  });

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

const close = (school: string, ...to: [string, number][]): Closure => ({
  school,
  receivers: to.map(([r, share]) => ({ school: r, share })),
  building: 'mothball',
});
const asClosed = (c: Closure, year = 2027): ClosedSchool => ({ ...c, year, saving: 0, staffKept: 0 });

describe('who can close and who can receive', () => {
  const game = newGame({ seed: 'rules' });

  it('closes only open schools with K-8 kids', () => {
    expect(canClose(game.schools, 'peninsula')).toBe(true);
    expect(canClose(game.schools, 'alliance')).toBe(false);
    expect(canClose({ ...game.schools, peninsula: { ...game.schools.peninsula, open: false } }, 'peninsula')).toBe(false);
  });

  it('sends kids only to open neighborhood schools serving some of their grades, nearest first', () => {
    const ids = receiverCandidates(game.schools, 'peninsula', [close('sitton', ['rosa-parks', 1])]).map((c) => c.id);
    for (const id of ['peninsula', 'sitton', 'alliance', 'access-academy', 'richmond', 'beaumont']) expect(ids).not.toContain(id);
    expect(ids).toContain('rosa-parks');
    const all = receiverCandidates(game.schools, 'peninsula', []);
    expect(all.map((c) => c.miles)).toEqual([...all.map((c) => c.miles)].sort((a, b) => a - b));
    const closed = { ...game.schools, 'rosa-parks': { ...game.schools['rosa-parks'], open: false } };
    expect(receiverCandidates(closed, 'peninsula', []).map((c) => c.id)).not.toContain('rosa-parks');
  });

  it('drops receivers that are citywide programs or serve none of the grades', () => {
    for (const r of ['alliance', 'access-academy', 'richmond', 'beaumont'])
      expect(normalizeClosures([close('peninsula', [r, 1])]), r).toEqual([]);
  });

  it('rounds the guess and drops one that is not a number', () => {
    const guess = (g: number) => normalizeClosures([{ ...close('peninsula', ['rosa-parks', 1]), guess: g }])[0].guess;
    expect(guess(3.7)).toBe(4);
    expect(guess(-2)).toBe(0);
    expect(guess(NaN)).toBeUndefined();
  });

  it('splits a grade only among receivers that serve it', () => {
    const c = close('cesar-chavez', ['woodlawn', 0.7], ['george', 0.3]);
    expect(receiversFor(c, 2)).toEqual([{ school: 'woodlawn', share: 1 }]);
    expect(receiversFor(c, 7)).toEqual([{ school: 'george', share: 1 }]);
  });
});

describe('closures taking effect', () => {
  const game = newGame({ seed: 'rules' });
  const peninsula = close('peninsula', ['rosa-parks', 1]);
  const sitton = close('sitton', ['rosa-parks', 1]);

  it('skips closures of closed schools and keeps only open receivers', () => {
    const schools = { ...game.schools, woodlawn: { ...game.schools.woodlawn, open: false } };
    const out = closuresTakingEffect(schools, [close('woodlawn', ['rosa-parks', 1]), close('peninsula', ['woodlawn', 0.5], ['rosa-parks', 0.5])], 24, 2027);
    expect(out.map((c) => c.school)).toEqual(['peninsula']);
    expect(out[0].receivers).toEqual([{ school: 'rosa-parks', share: 1 }]);
  });

  it('prices a second closure into the same receiver after the first has moved in', () => {
    const [, second] = closuresTakingEffect(game.schools, [peninsula, sitton], 24, 2027);
    expect(second.saving).toBe(closureSaving(withArrivals(game.schools, peninsula), sitton, 24));
    expect(second.saving).not.toBe(closureSaving(game.schools, sitton, 24));
  });

  it("keeps on the payroll only the closed school's staff the receivers' new steps don't need", () => {
    const [c] = closuresTakingEffect(game.schools, [peninsula], 24, 2027);
    const rp = game.schools['rosa-parks'].enrollment;
    const pen = game.schools.peninsula.enrollment;
    expect(c.staffKept).toBe(otherStaff(pen) - 2 - (otherStaff(rp + pen) - otherStaff(rp)));
  });

  it('books the one-time cost only for closures that can happen', () => {
    const schools = { ...game.schools, peninsula: { ...game.schools.peninsula, open: false } };
    const plan = (closures: Closure[]) =>
      computeBudget({ ...game.sim!, ...budgetArgs(game), schools, policy: { ...DEFAULT_POLICY, closures } }).lines.find(
        (l) => l.key === 'closureOneTime',
      );
    expect(plan([close('chief-joseph', ['peninsula', 1])])).toBeUndefined();
    expect(plan([peninsula])).toBeUndefined();
    expect(plan([close('chief-joseph', ['beach', 1])])).toBeDefined();
  });

  it('counts the other closures in the plan on the chip', () => {
    const chip = closureChip(game, sitton, [peninsula, sitton], 24);
    const s = game.schools;
    expect(chip.seats.kids).toBe(s['rosa-parks'].enrollment + s.peninsula.enrollment + s.sitton.enrollment);
    expect(closureChip(game, sitton, [], 24).seats.kids).toBe(s['rosa-parks'].enrollment + s.sitton.enrollment);
  });

  it('counts seats only for the grades each receiver serves', () => {
    const chip = closureChip(game, close('cesar-chavez', ['george', 1]), [], 24);
    const middle = game.schools['cesar-chavez'].byGrade.slice(6).reduce((a, n) => a + n, 0);
    expect(chip.seats.kids).toBe(game.schools.george.enrollment + middle);
    const pos = (id: string): [number, number] => [SCHOOL_INFO.get(id)!.data.x, SCHOOL_INFO.get(id)!.data.y];
    const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) / METERS_PER_MILE;
    const kids = game.households.filter((h) => h.school === 'cesar-chavez' && gradeOf(h) >= 6);
    const walk = kids.reduce((a, h) => a + dist(h.pos, pos('george')) - dist(h.pos, pos('cesar-chavez')), 0) / kids.length;
    expect(chip.walkMiles).toBeCloseTo(walk, 6);
  });
});

function budgetArgs(game: GameState) {
  const sim = game.sim!;
  return {
    year: game.year,
    reserves: game.budget.reserves,
    priorSpending: sim.spending,
    restRevenue: sim.restRevenue,
    restCost: sim.restCost,
    stateFunding: 1,
    levyRate: 1.99,
    closed: sim.closed,
  };
}

describe('closure phasing past maturity', () => {
  it('books nothing unrealized years later', () => {
    const game = newGame({ seed: 'rules' });
    const schools = { ...game.schools, peninsula: { ...game.schools.peninsula, open: false } };
    const closed = { ...asClosed(close('peninsula', ['rosa-parks', 1])), saving: 1e6 };
    const b = computeBudget({ ...budgetArgs(game), year: 2031, cumulativeCuts: 0, homeroomsCut: 0, schools, policy: DEFAULT_POLICY, closed: [closed] });
    expect(b.lines.find((l) => l.key === 'closurePhasing')).toBeUndefined();
    expect(Number.isFinite(b.gap)).toBe(true);
  });
});

describe('a mover\'s choice', () => {
  const h = newGame({ seed: 'rules' }).households.find((x) => x.school === 'peninsula')!;

  it('finds a riskier building only when the closed one was safer', () => {
    expect(isRiskier('rieke', 'peninsula')).toBe(true);
    expect(isRiskier('rieke', 'creston')).toBe(false);
    expect(isRiskier('rosa-parks', 'peninsula')).toBe(false);
  });

  it('reads its factors from the household, the closure and the target', () => {
    const one = close('peninsula', ['rieke', 1]);
    const f = followFactors(h, one, 'rieke');
    expect(f).toMatchObject({ riskier: true, movedBefore: false, wholeClasses: true, loyalty: h.loyalty, exitCapacity: h.exitCapacity });
    expect(f.miles).toBeGreaterThan(1);
    expect(followFactors({ ...h, forcedMoves: 1 }, one, 'rieke').movedBefore).toBe(true);
    expect(followFactors(h, close('peninsula', ['rieke', 0.5], ['rosa-parks', 0.5]), 'rosa-parks')).toMatchObject({
      riskier: false,
      wholeClasses: false,
    });
  });

  it('shifts each school\'s follow rate by up to 5 points', () => {
    const offsets = [...SCHOOL_INFO.keys()].map((id) => schoolFollowOffset(7, id));
    for (const o of offsets) expect(Math.abs(o)).toBeLessThanOrEqual(0.05);
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(0.05);
  });
});

describe('nearestOpen', () => {
  const at = (id: string): [number, number] => [SCHOOL_INFO.get(id)!.data.x, SCHOOL_INFO.get(id)!.data.y];
  const none = new Map<string, ClosedSchool>();

  it('prefers a school with a free seat', () => {
    expect(nearestOpen(at('rosa-parks'), 2, none)).toBe('rosa-parks');
    const full = new Map([['rosa-parks', 594]]);
    expect(nearestOpen(at('rosa-parks'), 2, none, new Set(), full)).not.toBe('rosa-parks');
  });

  it('falls back to any open school when none serves the grade', () => {
    const closed = new Map(
      [...SCHOOL_INFO.values()].filter((i) => i.hi >= 7).map((i) => [i.data.id, asClosed(close(i.data.id, ['rosa-parks', 1]))]),
    );
    const id = nearestOpen(at('george'), 7, closed);
    expect(id).toBeTruthy();
    expect(closed.has(id)).toBe(false);
  });
});

describe('decideClosures', () => {
  const game = newGame({ seed: 'rules' });
  function decide(closure: Closure, followRate: number) {
    const closed = asClosed(closure);
    const flows: Flows = { stayed: 0, movedWithinPps: 0, leftPps: 0, cameBack: 0, enteredK: 0, graduated: 0 };
    const region = { kids: 0, leavers: 0 };
    const movers: Mover[] = [];
    const households: Household[] = [];
    for (const before of game.households) {
      if (before.school !== closure.school || gradeOf(before) >= 5) {
        households.push(before);
        continue;
      }
      const next: Household = { ...before, kids: oneKid(gradeOf(before) + 1), school: null, status: 'moved' };
      movers.push({ before, next, closure: closed, fallback: closure.receivers[0].school, region });
      households.push(next);
    }
    const [tally] = decideClosures({
      seed: 1,
      year: 2027,
      followRate,
      closed: new Map([[closure.school, closed]]),
      closing: [closed],
      movers,
      households,
      flows,
    });
    return { flows, region, tally, nexts: movers.map((m) => m.next), households };
  }

  it('sorts every mover into moved within PPS or left, by region too', () => {
    const { flows, region, nexts } = decide(close('peninsula', ['rosa-parks', 1]), 0);
    const left = nexts.filter((h) => h.school === null);
    expect(flows.movedWithinPps).toBe(nexts.length - left.length);
    expect(flows.leftPps).toBe(left.length);
    expect(region.leavers).toBe(left.length);
    expect(left.some((h) => h.movedAway)).toBe(true);
    expect(nexts.every((h) => h.fundedAs === 'peninsula')).toBe(true);
  });

  it('moves kids crowded out of a receiver to another PPS school', () => {
    const { flows, tally, nexts, households } = decide(close('forest-park', ['skyline', 1]), 2);
    expect(tally.left).toBe(0);
    expect(tally.otherPps).toBeGreaterThan(0);
    expect(flows.movedWithinPps).toBe(nexts.length);
    expect(households.filter((h) => h.school === 'skyline').length).toBe(Math.floor(1.1 * 282));
  });
});

describe('familiesDecide and closures', () => {
  const game = newGame({ seed: 'rules' });

  it('clears last year\'s trails', () => {
    const marked = game.households.map((h) => ({ ...h, movedFrom: 'peninsula' }));
    expect(familiesDecide(game.sim!, marked, 2027, 24, 0).households.some((h) => h.movedFrom)).toBe(false);
  });

  it('takes no citywide intake into a closed program', () => {
    const access = asClosed(close('access-academy', ['beaumont', 1]), 2026);
    const was = new Map(game.households.map((h) => [h.id, h.school]));
    const out = familiesDecide(game.sim!, game.households, 2027, 24, 0, {
      closed: [access],
      cards: { followRate: 0.9, closedZoneCaptureDrop: 0 },
    }).households;
    expect(out.filter((h) => h.school === 'access-academy' && was.get(h.id) !== 'access-academy')).toEqual([]);
  });

  it('funds kindergartners from a closed zone at the closed school\'s weight', () => {
    const out = familiesDecide(game.sim!, game.households, 2027, 24, 0, {
      closed: [asClosed(close('peninsula', ['rosa-parks', 1]), 2026)],
      cards: { followRate: 0.9, closedZoneCaptureDrop: 0 },
    }).households;
    const funded = out.filter((h) => h.fundedAs === 'peninsula');
    expect(funded.length).toBeGreaterThan(10);
    for (const h of funded) expect(h.kids[0]).toBe(1);
  });
});

describe('state revenue', () => {
  it('follows each kid\'s funding weight, not the building', () => {
    const h = newGame({ seed: 'rules' }).households.find((x) => x.school === 'rosa-parks')!;
    expect(buildSchools([h], 24)['rosa-parks'].stateRevenue).toBeCloseTo(revenuePerStudent(0.6294));
    expect(buildSchools([{ ...h, fundedAs: 'peninsula' }], 24)['rosa-parks'].stateRevenue).toBeCloseTo(revenuePerStudent(0.2));
  });

  it('adds up in the budget', () => {
    const game = newGame({ seed: 'rules' });
    const total = Object.values(game.schools).reduce((a, s) => a + s.stateRevenue, 0);
    expect(game.budget.lines.find((l) => l.key === 'stateK8')!.amount).toBeCloseTo(total, 0);
  });
});
