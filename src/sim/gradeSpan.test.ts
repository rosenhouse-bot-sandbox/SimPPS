import { describe, expect, it } from 'vitest';
import {
  ballotPreview,
  boundaryChip,
  closureChip,
  DEFAULT_POLICY,
  endYear,
  modeledRange,
  newGame,
  normalizePolicy,
  plannedZones,
  receiverCandidates,
  type BoundaryEdit,
  type GameState,
  type Policy,
} from '.';
import { rezoneFactors, stayDraw } from './boundaries';
import { followChance } from './closures';
import { defaultZones } from './zones';
import { canConvert, conversionChip, effectiveGradeChanges, middleSchoolCandidates, normalizeGradeChanges } from './gradeSpan';
import { gradeOf, M } from './model';
import { buildSchools } from './schools';
import type { Closure } from './types';

const middleGrades = (s: GameState, id: string) => s.schools[id].byGrade.slice(6).reduce((a, n) => a + n, 0);

describe('who can change grade span', () => {
  const { schools } = newGame({ seed: 'span' });

  it('converts open neighborhood K-8s only', () => {
    expect(canConvert(schools, 'beverly-cleary')).toBe(true);
    expect(canConvert(schools, 'cesar-chavez')).toBe(true);
    for (const id of ['beaumont', 'rosa-parks', 'metropolitan-learning-center', 'nowhere']) expect(canConvert(schools, id)).toBe(false);
    expect(canConvert({ ...schools, vernon: { ...schools.vernon, open: false } }, 'vernon')).toBe(false);
    expect(canConvert({ ...schools, vernon: { ...schools.vernon, converted: { year: 2027, to: 'harriet-tubman' } } }, 'vernon')).toBe(false);
  });

  it('sends grades 6-8 only to open zoned middle schools, nearest first', () => {
    const picks = middleSchoolCandidates(schools, 'beverly-cleary', []);
    expect(picks[0].id).toBe('beaumont');
    expect(picks.map((p) => p.miles)).toEqual([...picks.map((p) => p.miles)].sort((a, b) => a - b));
    expect(picks.map((p) => p.id)).not.toContain('da-vinci');
    expect(picks.map((p) => p.id)).not.toContain('laurelhurst');
    expect(middleSchoolCandidates({ ...schools, beaumont: { ...schools.beaumont, open: false } }, 'beverly-cleary', [])[0].id).not.toBe('beaumont');
  });

  it('offers no middle school the plan closes', () => {
    const beaumont: Closure = { school: 'beaumont', receivers: [{ school: 'mt-tabor', share: 1 }], building: 'mothball' };
    expect(middleSchoolCandidates(schools, 'beverly-cleary', [beaumont]).map((p) => p.id)).not.toContain('beaumont');
  });

  it('takes effect only into an open receiver', () => {
    const change = { school: 'beverly-cleary', to: 'beaumont' };
    expect(effectiveGradeChanges(schools, [change])).toEqual([change]);
    expect(effectiveGradeChanges({ ...schools, beaumont: { ...schools.beaumont, open: false } }, [change])).toEqual([]);
  });

  it('keeps one change per K-8 into a middle school, neither closing in the plan', () => {
    const close = (school: string): Closure => ({ school, receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' });
    expect(
      normalizeGradeChanges(
        [
          { school: 'beverly-cleary', to: 'beaumont' },
          { school: 'beverly-cleary', to: 'mt-tabor' },
          { school: 'rosa-parks', to: 'george' },
          { school: 'vernon', to: 'faubion' },
          { school: 'faubion', to: 'ockley-green' },
          { school: 'laurelhurst', to: 'mt-tabor' },
        ],
        [close('faubion'), close('mt-tabor')],
      ),
    ).toEqual([{ school: 'beverly-cleary', to: 'beaumont' }]);
  });

  it('is part of a normalized policy', () => {
    const p = { ...DEFAULT_POLICY, gradeChanges: [{ school: 'vernon', to: 'vernon' }] } as Policy;
    expect(normalizePolicy(p).gradeChanges).toEqual([]);
    expect(normalizePolicy({ ...DEFAULT_POLICY, gradeChanges: undefined } as unknown as Policy).gradeChanges).toEqual([]);
  });
});

describe('Send 6-8 over the years', () => {
  const start = newGame({ seed: 'span' });
  const policy: Policy = { ...DEFAULT_POLICY, gradeChanges: [{ school: 'beverly-cleary', to: 'beaumont' }] };
  const { next, report } = endYear(start, policy);
  const quo = endYear(start, DEFAULT_POLICY).next;
  const movers = next.households.filter((h) => h.movedFrom === 'beverly-cleary');
  const year2 = endYear(next, DEFAULT_POLICY).next;

  it('empties grades 6-8 by fall and keeps K-5', () => {
    expect(middleGrades(start, 'beverly-cleary')).toBeGreaterThan(50);
    expect(middleGrades(next, 'beverly-cleary')).toBe(0);
    expect(middleGrades(year2, 'beverly-cleary')).toBe(0);
    expect(next.schools['beverly-cleary'].byGrade.slice(0, 6)).toEqual(quo.schools['beverly-cleary'].byGrade.slice(0, 6));
    expect(next.schools['beverly-cleary'].converted).toEqual({ year: 2027, to: 'beaumont' });
    expect(next.policy.gradeChanges).toEqual([]);
  });

  it('loses homerooms and a few seats', () => {
    expect(next.schools['beverly-cleary'].homerooms).toBeLessThan(quo.schools['beverly-cleary'].homerooms);
    expect(next.schools['beverly-cleary'].capacity).toBeCloseTo(783 * M.conversionCapacity);
    expect(next.schools['beaumont'].enrollment).toBeGreaterThan(quo.schools['beaumont'].enrollment + 40);
  });

  it('moves its rising 7th and 8th graders, who decide like a forced move', () => {
    expect(movers.length).toBeGreaterThan(30);
    for (const h of movers) {
      expect([7, 8]).toContain(gradeOf(h));
      expect(h.forcedMoves).toBe(1);
      expect(h.fundedAs).toBeUndefined();
    }
    const stay = movers.filter((h) => h.school !== null).length / movers.length;
    expect(stay).toBeGreaterThan(0.8);
    expect(movers.filter((h) => h.school === 'beaumont').length).toBeGreaterThan(movers.length / 2);
  });

  it('sends its 6th graders to the receiver as a grade-6 transition', () => {
    const sixth = next.households.filter((h) => gradeOf(h) === 6 && start.households.some((b) => b.id === h.id && b.school === 'beverly-cleary'));
    expect(sixth.length).toBeGreaterThan(10);
    expect(sixth.filter((h) => h.school === 'beaumont').length).toBeGreaterThan(sixth.length / 2);
    expect(sixth.every((h) => h.movedFrom === undefined)).toBe(true);
  });

  it('zones its middle grades to the receiver from then on', () => {
    const was = defaultZones().middle.flatMap((s, c) => (s === 'beverly-cleary' ? [c] : []));
    expect(was.length).toBeGreaterThan(0);
    expect(plannedZones(start, policy).middle.filter((s) => s === 'beverly-cleary')).toEqual([]);
    for (const c of was) expect(next.zones.middle[c]).toBe('beaumont');
    expect(next.zones.elementary).toEqual(quo.zones.elementary);
    expect(next.households.some((h) => gradeOf(h) >= 6 && h.zoneSchool === 'beverly-cleary')).toBe(false);
  });

  it('reports where the movers went', () => {
    const at = (school: string | null) => movers.filter((h) => h.school === school).length;
    expect(report.conversions).toEqual([
      {
        school: 'beverly-cleary',
        to: 'beaumont',
        kids: modeledRange(movers.length),
        receiver: modeledRange(at('beaumont')),
        otherPps: modeledRange(movers.length - at(null) - at('beaumont')),
        leftPps: modeledRange(at(null)),
      },
    ]);
    expect(report.events.map((e) => e.title)).toContain('Beverly Cleary School becomes K-5');
  });

  it('sends each mover to the receiver exactly when its draw beats model.gradeSpan, and the rest elsewhere', () => {
    const before = new Map(start.households.map((h) => [h.id, h]));
    for (const h of movers) {
      const stays = stayDraw(start.sim!.seedHash, 2027, h.id) < followChance(M.conversionStay, rezoneFactors(before.get(h.id)!, 'beaumont'));
      expect(h.school === 'beaumont', String(h.id)).toBe(stays);
    }
  });

  it('keeps grades 6-8 out after a later 6-8 boundary edit into it', () => {
    const cells = next.zones.middle.flatMap((s, c) => (s === 'beaumont' ? [c] : [])).slice(0, 30);
    const edit: BoundaryEdit = { level: 'middle', to: 'beverly-cleary', cells, grandfather: false };
    const after = endYear(next, { ...next.policy, boundaryEdits: [edit] }).next;
    expect(after.zones.middle).not.toContain('beverly-cleary');
    expect(middleGrades(after, 'beverly-cleary')).toBe(0);
  });

  it('sends movers whose block a boundary edit moves to their new zone school', () => {
    const own = defaultZones().middle.flatMap((s, c) => (s === 'beverly-cleary' ? [c] : []));
    const cells = own.slice(0, Math.ceil(own.length / 2));
    const edit: BoundaryEdit = { level: 'middle', to: 'mt-tabor', cells, grandfather: false };
    const both = endYear(start, { ...policy, boundaryEdits: [edit] }).next;
    const stayed = both.households.filter((h) => h.movedFrom === 'beverly-cleary' && cells.includes(h.cell) && h.school !== null);
    expect(stayed.length).toBeGreaterThan(5);
    expect(stayed.filter((h) => h.school === 'mt-tabor').length).toBeGreaterThan(stayed.length / 2);
  });

  it("drops a boundary chip's 6-8 edit into a K-8 the plan converts", () => {
    const cells = defaultZones().middle.flatMap((s, c) => (s === 'beaumont' ? [c] : [])).slice(0, 30);
    const edit: BoundaryEdit = { level: 'middle', to: 'beverly-cleary', cells, grandfather: false };
    expect(boundaryChip(start, edit, DEFAULT_POLICY).kidsMoving).toBeGreaterThan(0);
    expect(boundaryChip(start, edit, policy).kidsMoving).toBe(0);
  });

  it("stirs the movers' regions in November's poll as the year will", () => {
    const poll = (gradeChanges: Policy['gradeChanges']) =>
      ballotPreview(start, { ...DEFAULT_POLICY, levyRate: 2.5, levyElection: 'november', gradeChanges })!.poll;
    expect(poll(policy.gradeChanges).hi).toBeLessThan(poll([]).hi);
  });

  it('leaves the ghost alone', () => {
    expect(next.sim!.ghost!.schools['beverly-cleary'].converted).toBeUndefined();
    expect(middleGrades(next.sim!.ghost!, 'beverly-cleary')).toBeGreaterThan(50);
  });

  it("sends a closing school's middle graders past a receiver that becomes K-5", () => {
    const laurelhurst: Closure = { school: 'laurelhurst', receivers: [{ school: 'beverly-cleary', share: 1 }], building: 'mothball' };
    const both = endYear(start, { ...policy, closures: [laurelhurst] }).next;
    expect(both.households.filter((h) => h.movedFrom === 'laurelhurst' && h.school === 'beverly-cleary').length).toBeGreaterThan(50);
    expect(middleGrades(both, 'beverly-cleary')).toBe(0);
  });

  it('offers a converted K-8 as a receiver only for K-5 kids', () => {
    const offered = (closing: string) => receiverCandidates(next.schools, closing, []).map((c) => c.id);
    expect(offered('laurelhurst')).toContain('beverly-cleary');
    expect(offered('mt-tabor')).not.toContain('beverly-cleary');
    expect(offered('beverly-cleary')).not.toContain('beaumont');
  });

  it('counts only K-5 kids who must choose when a converted K-8 closes', () => {
    const closure: Closure = { school: 'beverly-cleary', receivers: [{ school: 'irvington', share: 1 }], building: 'mothball' };
    const k4 = next.households.filter((h) => h.school === 'beverly-cleary' && gradeOf(h) < 5).length;
    expect(closureChip(next, closure, [], 24).kidsMoving).toBe(k4);
  });

  it('marks converted schools in buildSchools', () => {
    const s = buildSchools([], 24, 0, [], [{ school: 'vernon', to: 'harriet-tubman', year: 2028 }]);
    expect(s.vernon.converted).toEqual({ year: 2028, to: 'harriet-tubman' });
    expect(s.faubion.converted).toBeUndefined();
  });
});

describe('Scenario A grade spans', () => {
  const a = newGame({ seed: 'span', start: 'scenario-a' });
  const next = endYear(a, a.policy).next;
  const later = endYear(endYear(next, next.policy).next, DEFAULT_POLICY).next;
  const converted = ['beverly-cleary', 'laurelhurst', 'bridger-creative-science', 'sunnyside-environmental', 'faubion', 'vernon', 'cesar-chavez'];

  it('loads its seven K-8 to K-5 conversions', () => {
    expect(a.policy.gradeChanges.map((g) => `${g.school}>${g.to}`)).toEqual([
      'beverly-cleary>beaumont',
      'laurelhurst>mt-tabor',
      'bridger-creative-science>harrison-park',
      'sunnyside-environmental>hosford',
      'faubion>ockley-green',
      'vernon>harriet-tubman',
      'cesar-chavez>george',
    ]);
  });

  it("lands most of Sunnyside's movers at Hosford, ahead of Sellwood's closure arrivals", () => {
    const sunny = next.households.filter((h) => h.movedFrom === 'sunnyside-environmental');
    expect(sunny.length).toBeGreaterThan(20);
    expect(sunny.filter((h) => h.school === 'hosford').length).toBeGreaterThan(sunny.length / 2);
  });

  it('leaves Beverly Cleary and the other six with no grades 6-8 after the first year and later', () => {
    for (const id of converted) {
      expect(middleGrades(next, id), id).toBe(0);
      expect(middleGrades(later, id), id).toBe(0);
    }
  });
});

describe('conversionChip', () => {
  const start = newGame({ seed: 'span' });
  const chip = conversionChip(start, { school: 'beverly-cleary', to: 'beaumont' }, DEFAULT_POLICY);
  const at = (grade: number) => start.households.filter((h) => h.school === 'beverly-cleary' && gradeOf(h) === grade).length;

  it('counts the plan\'s other arrivals at the receiver', () => {
    const laurelhurst = { school: 'laurelhurst', to: 'beaumont' };
    const roseway: Closure = { school: 'roseway-heights', receivers: [{ school: 'beaumont', share: 1 }], building: 'mothball' };
    const withOthers = conversionChip(start, { school: 'beverly-cleary', to: 'beaumont' }, { ...DEFAULT_POLICY, gradeChanges: [laurelhurst], closures: [roseway] });
    const lh = conversionChip(start, laurelhurst, DEFAULT_POLICY);
    expect(withOthers.seats.kids).toBeGreaterThan(chip.seats.kids + lh.seats.kids - start.schools.beaumont.enrollment);
  });

  it('counts rising 7th and 8th graders, who must choose', () => {
    expect(chip.kidsMoving).toBe(at(6) + at(7));
  });

  it("counts the receiver's seats if every rising 6th to 8th grader arrives", () => {
    expect(chip.seats).toEqual({ kids: start.schools.beaumont.enrollment + at(5) + at(6) + at(7), capacity: start.schools.beaumont.capacity });
  });
});
