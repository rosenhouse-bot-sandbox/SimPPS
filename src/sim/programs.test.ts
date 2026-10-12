import { describe, expect, it } from 'vitest';
import { SCHOOLS } from '../data';
import { ballotPreview, DEFAULT_POLICY, endYear, modeledRange, newGame, normalizePolicy, type GameState, type Policy, type ProgramMove } from '.';
import type { Point } from '../data';
import { schoolPos } from './closures';
import { gradeOf, M, METERS_PER_MILE } from './model';
import { DLI_PROGRAMS, normalizeProgramMoves, programMoveDraw, programSite, programStay } from './programs';
import type { Closure, Household, Program } from './types';

const dliAt = (s: GameState, school: string, program: Program) =>
  s.households.filter((h) => h.school === school && h.program === program).length;

describe('DLI kids at the start', () => {
  const game = newGame({ seed: 'dli' });

  it('fills each school to its 2025-26 DLI count, or all its kids when fewer', () => {
    for (const s of SCHOOLS) {
      const kids = game.households.filter((h) => h.school === s.id);
      const dli = kids.filter((h) => h.program).length;
      expect(dli, s.id).toBe(Math.min(s.dliStudents ?? 0, kids.length));
    }
  });

  it('gives kids only their school’s languages, Chinese as Mandarin, splitting a two-language school evenly', () => {
    expect(DLI_PROGRAMS.get('clark')).toEqual(['Mandarin']);
    expect(DLI_PROGRAMS.get('roseway-heights')).toEqual(['Spanish', 'Vietnamese']);
    for (const h of game.households) if (h.program) expect(DLI_PROGRAMS.get(h.school!), String(h.id)).toContain(h.program);
    expect(dliAt(game, 'roseway-heights', 'Spanish') - dliAt(game, 'roseway-heights', 'Vietnamese')).toBe(1);
  });

  it('counts each school’s DLI kids by program', () => {
    expect(game.schools.beach.dli).toEqual({ Spanish: dliAt(game, 'beach', 'Spanish') });
    expect(game.schools['roseway-heights'].dli).toEqual({ Spanish: 79, Vietnamese: 78 });
    expect(game.schools.whitman.dli).toBeUndefined();
  });

  it('is the same for a seed and differs between seeds', () => {
    const ids = (s: GameState) => s.households.filter((h) => h.program).map((h) => h.id);
    expect(ids(newGame({ seed: 'dli' }))).toEqual(ids(game));
    expect(ids(newGame({ seed: 'other' }))).not.toEqual(ids(game));
  });
});

describe('program moves in a plan', () => {
  const clark: ProgramMove = { program: 'Mandarin', from: ['clark'], to: 'woodstock' };
  const close = (school: string): Closure => ({ school, receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' });

  it('keeps moves to another known school that no plan closes, one per program and school', () => {
    expect(normalizeProgramMoves([clark], [])).toEqual([clark]);
    expect(normalizeProgramMoves([{ ...clark, to: 'clark' }], [])).toEqual([]);
    expect(normalizeProgramMoves([{ ...clark, to: 'nowhere' }], [])).toEqual([]);
    expect(normalizeProgramMoves([{ ...clark, from: ['clark', 'nowhere', 'woodstock'] }], [])).toEqual([clark]);
    expect(normalizeProgramMoves([clark], [close('woodstock')])).toEqual([]);
    expect(normalizeProgramMoves([clark], [close('clark')])).toEqual([clark]);
    expect(normalizeProgramMoves([clark, { ...clark, to: 'kelly' }], [])).toEqual([clark]);
    expect(normalizeProgramMoves([{ ...clark, program: 'Klingon' as Program }], [])).toEqual([]);
  });

  it('is part of a normalized policy', () => {
    expect(normalizePolicy({ ...DEFAULT_POLICY, programMoves: [{ ...clark, to: 'clark' }] }).programMoves).toEqual([]);
    expect(normalizePolicy({ ...DEFAULT_POLICY, programMoves: undefined } as unknown as Policy).programMoves).toEqual([]);
  });

  it('follows a program through its moves', () => {
    const moves = [{ ...clark, year: 2027 }, { program: 'Mandarin' as const, from: ['woodstock'], to: 'kelly', year: 2028 }];
    expect(programSite(moves, 'clark', 'Mandarin')).toBe('kelly');
    expect(programSite(moves, 'clark', 'Spanish')).toBe('clark');
  });
});

describe('a program move over the years', () => {
  const clark: ProgramMove = { program: 'Mandarin', from: ['clark'], to: 'woodstock' };
  const start = newGame({ seed: 'move' });
  const policy: Policy = { ...DEFAULT_POLICY, programMoves: [clark] };
  const { next, report } = endYear(start, policy);
  const quo = endYear(start, DEFAULT_POLICY).next;
  const before = new Map(start.households.map((h) => [h.id, h]));
  /** Clark's Mandarin kids still in its grades this fall. */
  const movers = next.households.filter((h) => {
    const b = before.get(h.id);
    return b?.school === 'clark' && b.program === 'Mandarin' && gradeOf(h) <= 5;
  });

  it('moves the program and its kids in summer', () => {
    expect(movers.length).toBeGreaterThan(50);
    expect(next.schools.clark.dli).toBeUndefined();
    expect(dliAt(next, 'clark', 'Mandarin')).toBe(0);
    expect(next.schools.woodstock.dli!.Mandarin).toBe(dliAt(next, 'woodstock', 'Mandarin'));
    expect(next.policy.programMoves).toEqual([]);
  });

  it('follows less often past 2 miles', () => {
    const at = (miles: number): Point => [schoolPos('woodstock')[0] + miles * METERS_PER_MILE, schoolPos('woodstock')[1]];
    expect(programStay(at(1), 'woodstock')).toBe(M.programMoveStay);
    expect(programStay(at(4), 'woodstock')).toBeCloseTo(M.programMoveStay - 2 * M.followPerMilePastOne);
  });

  it('sends each kid to the receiver exactly when its draw beats model.programMove', () => {
    for (const h of movers) {
      const follows = programMoveDraw(start.sim!.seedHash, 2027, h.id) < programStay(h.pos, 'woodstock');
      expect(h.school === 'woodstock' && h.program === 'Mandarin', String(h.id)).toBe(follows);
      if (follows) expect(h).toMatchObject({ movedFrom: 'clark', forcedMoves: 1, status: 'moved' });
    }
  });

  it('leaves the rest at their school without the program, unless they leave like any family', () => {
    const stayers = movers.filter((h) => h.school !== 'woodstock');
    expect(stayers.length).toBeGreaterThan(0);
    for (const h of stayers) {
      expect(h.program).toBeUndefined();
      expect([null, 'clark']).toContain(h.school);
    }
  });

  it("stirs the movers' regions in November's poll as the year will", () => {
    const poll = (state: GameState, programMoves: ProgramMove[]) =>
      ballotPreview(state, { ...DEFAULT_POLICY, levyRate: 2.5, levyElection: 'november', programMoves })!.poll;
    expect(poll(start, [clark]).hi).toBeLessThan(poll(start, []).hi);
    const graduating = { ...start, households: start.households.filter((h) => h.school !== 'clark' || gradeOf(h) === 5) };
    expect(poll(graduating, [clark])).toEqual(poll(graduating, []));
  });

  it('reports where the kids went', () => {
    const at = (school: string | null) => movers.filter((h) => h.school === school).length;
    expect(report.programMoves).toEqual([
      {
        program: 'Mandarin',
        from: ['clark'],
        to: 'woodstock',
        kids: modeledRange(movers.length),
        receiver: modeledRange(at('woodstock')),
        leftDli: modeledRange(movers.length - at('woodstock') - at(null)),
        leftPps: modeledRange(at(null)),
      },
    ]);
    expect(report.events.map((e) => e.title)).toContain('Mandarin DLI moves to Woodstock Elementary School');
  });

  it('enrolls new Mandarin kindergartners from Clark’s pickers at Woodstock from then on', () => {
    const year2 = endYear(next, next.policy).next;
    const quo2 = endYear(quo, quo.policy).next;
    const kAt = (s: GameState, school: string) => s.households.filter((h) => gradeOf(h) === 0 && h.school === school && h.program === 'Mandarin').length;
    expect(kAt(year2, 'clark')).toBe(0);
    expect(kAt(quo2, 'clark')).toBeGreaterThan(5);
    expect(kAt(year2, 'woodstock')).toBe(kAt(quo2, 'woodstock') + kAt(quo2, 'clark'));
  });

  it('drops the program when a kid leaves PPS or reaches a school without it', () => {
    const offered = (h: Household) => h.school !== null && h.program !== undefined && h.program in (quo.schools[h.school].dli ?? {});
    for (const h of quo.households) if (h.program) expect(offered(h), String(h.id)).toBe(true);
  });
});

describe('which program moves happen', () => {
  const start = newGame({ seed: 'which' });
  const kids = (programMoves: ProgramMove[], gradeChanges: Policy['gradeChanges'] = []) =>
    endYear(start, { ...DEFAULT_POLICY, programMoves, gradeChanges }).report.programMoves.map((m) => [m.from, m.kids.hi > modeledRange(0).hi]);

  it('moves only from schools that offer the program', () => {
    expect(kids([{ program: 'Spanish', from: ['whitman', 'beach'], to: 'clark' }])).toEqual([[['beach'], true]]);
  });

  it("moves kids still in their school's grades", () => {
    const younger = start.households.filter((h) => h.school === 'beach' && h.program === 'Spanish' && gradeOf(h) < 5).length;
    const [move] = endYear(start, { ...DEFAULT_POLICY, programMoves: [{ program: 'Spanish', from: ['beach'], to: 'cesar-chavez' }] }).report.programMoves;
    expect(move.kids).toEqual(modeledRange(younger));
  });

  it('moves no kid into a school that does not serve its grade', () => {
    expect(kids([{ program: 'Mandarin', from: ['clark'], to: 'harrison-park' }])).toEqual([[['clark'], false]]);
    expect(kids([{ program: 'Spanish', from: ['beaumont'], to: 'cesar-chavez' }])).toEqual([[['beaumont'], true]]);
    expect(kids([{ program: 'Spanish', from: ['beaumont'], to: 'cesar-chavez' }], [{ school: 'cesar-chavez', to: 'george' }])).toEqual([
      [['beaumont'], false],
    ]);
  });
});

describe('DLI kids in status quo', () => {
  const start = newGame({ seed: 'quo' });
  const year1 = endYear(start, DEFAULT_POLICY).next;
  const year3 = endYear(endYear(year1, DEFAULT_POLICY).next, DEFAULT_POLICY).next;

  it('send a 5th grader to the nearest middle school with the program', () => {
    const fifth = new Set(start.households.filter((h) => h.school === 'richmond' && gradeOf(h) === 5).map((h) => h.id));
    const sixth = year1.households.filter((h) => fifth.has(h.id) && h.school !== null);
    expect(sixth.length).toBeGreaterThan(40);
    for (const h of sixth) expect(h, String(h.id)).toMatchObject({ school: 'mt-tabor', program: 'Japanese' });
  });

  it('keep each school’s program about as large over the years', () => {
    for (const [id, p] of [['mt-tabor', 'Japanese'], ['kellogg', 'Spanish'], ['richmond', 'Japanese'], ['clark', 'Mandarin']] as const)
      expect(year3.schools[id].dli![p]! / start.schools[id].dli![p]!, id).toBeGreaterThan(0.8);
  });
});

describe('PPS Scenario A', () => {
  const start = newGame({ seed: 'scenario', start: 'scenario-a' });
  const { next } = endYear(start, start.policy);
  const SPANISH_FROM = ['beach', 'james-john', 'sitton'];

  it('loads its modeled program moves', () => {
    expect(start.policy.programMoves.map((m) => `${m.program} ${m.from.join('+')}>${m.to}`)).toEqual([
      'Spanish beach+james-john+sitton>cesar-chavez',
      'Spanish atkinson>lent',
      'Spanish scott>rigler',
      'Spanish beaumont>roseway-heights',
      'Spanish ockley-green>george',
      'Vietnamese rose-city-park>vestal',
      'Mandarin clark>woodstock',
      'Mandarin dr-martin-luther-king-jr>boise-eliot',
    ]);
    expect(newGame({ seed: 'scenario', start: 'scenario-b' }).policy.programMoves.map((m) => m.to)).not.toContain('vestal');
    expect(normalizePolicy(start.policy)).toEqual(start.policy);
  });

  it('after year 1, leaves Beach, James John and Sitton no Spanish DLI kids and Cesar Chavez most of them', () => {
    const moved = start.households.filter((h) => SPANISH_FROM.includes(h.school!) && h.program === 'Spanish' && gradeOf(h) < 5);
    expect(moved.length).toBeGreaterThan(250);
    for (const id of SPANISH_FROM) expect(dliAt(next, id, 'Spanish'), id).toBe(0);
    const ids = new Set(moved.map((h) => h.id));
    const atChavez = next.households.filter((h) => ids.has(h.id) && h.school === 'cesar-chavez' && h.program === 'Spanish').length;
    expect(atChavez / moved.length).toBeGreaterThan(0.75);
  });
});
