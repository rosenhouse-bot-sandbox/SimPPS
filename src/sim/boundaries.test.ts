import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, endYear, modeledRange, newGame, normalizePolicy, previewBudget } from '.';
import { boundaryChip, decideRezoned, projectRiders, rezoneFactors, sliceEdit } from './boundaries';
import { costIndex } from './budget';
import { followChance } from './closures';
import { gradeOf, M } from './model';
import type { BoundaryEdit, GameState, Household, Policy } from './types';
import { homesByCell, sliceCells, zoningYear } from './zones';

const start = newGame({ seed: 'bounds' });
const quo = endYear(start, DEFAULT_POLICY);
const line = (b: GameState['budget'], key: string) => b.lines.find((l) => l.key === key)?.amount ?? 0;
const inCells = (edit: BoundaryEdit) => {
  const cells = new Set(edit.cells);
  return (h: Household) => cells.has(h.cell);
};
const play = (edit: BoundaryEdit, policy: Policy = DEFAULT_POLICY) => endYear(start, { ...policy, boundaryEdits: [edit] });

/** The 30% of Creston's zone nearest Creston, moved to Atkinson. */
const nearCreston = (grandfather: boolean): BoundaryEdit => ({
  ...sliceEdit(start, 'elementary', 'creston', 'creston', 30, grandfather),
  to: 'atkinson',
});

describe('a grandfathered boundary edit', () => {
  const edit = nearCreston(true);
  const { next, report } = play(edit);
  const before = new Map(start.households.map((h) => [h.id, h]));
  const moved = next.households.filter(inCells(edit));

  it('keeps current students at their school and in their old zone', () => {
    const stayed = moved.filter((h) => before.get(h.id)?.school === 'creston' && gradeOf(h) <= 5 && h.school !== null);
    expect(stayed.length).toBeGreaterThan(20);
    for (const h of stayed.filter((x) => x.school !== 'access-academy')) {
      expect(h.school).toBe('creston');
      expect(h.zoneSchool).toBe('creston');
    }
    expect(report.rezoned).toBeUndefined();
  });

  it('zones new kindergartners and kids outside PPS to the new school', () => {
    const entrants = moved.filter((h) => !before.has(h.id));
    expect(entrants.length).toBeGreaterThan(5);
    for (const h of entrants) expect(h.zoneSchool).toBe('atkinson');
    expect(entrants.filter((h) => h.school === 'atkinson').length).toBeGreaterThan(0);
    expect(entrants.filter((h) => h.school === 'creston')).toEqual([]);
    const outside = moved.filter((x) => before.get(x.id)?.school === null && x.school === null && gradeOf(x) <= 5);
    expect(outside.length).toBeGreaterThan(5);
    for (const h of outside) expect(h.zoneSchool).toBe('atkinson');
  });

  it('keeps the edit in the zone map and clears it from the next plan', () => {
    for (const c of edit.cells) expect(next.zones.elementary[c]).toBe('atkinson');
    expect(next.policy.boundaryEdits).toEqual([]);
    const later = endYear(next, next.policy).next;
    for (const c of edit.cells) expect(later.zones.elementary[c]).toBe('atkinson');
  });
});

describe('a boundary edit without grandfathering', () => {
  const edit = sliceEdit(start, 'elementary', 'creston', 'atkinson', 100, false);
  const { next, report } = play(edit);
  const movers = next.households.filter((h) => h.movedFrom === 'creston');

  it("moves every kid zoned to and attending the old school, at summer", () => {
    const continuing = next.households.filter(inCells(edit)).filter((h) => h.school !== null && gradeOf(h) <= 5);
    expect(continuing.filter((h) => h.school === 'creston')).toEqual([]);
    expect(movers.length).toBeGreaterThan(80);
    for (const h of movers) expect(h.forcedMoves).toBe(1);
  });

  it('keeps about 97% in PPS, mostly at the new zone school', () => {
    const inPps = movers.filter((h) => h.school !== null).length / movers.length;
    expect(inPps).toBeGreaterThan(0.9);
    expect(inPps).toBeLessThan(0.995);
    expect(movers.filter((h) => h.school === 'atkinson').length / movers.length).toBeGreaterThan(0.85);
    expect(report.rezoned).toEqual({
      kids: modeledRange(movers.length),
      zoneSchool: modeledRange(movers.filter((h) => h.school === 'atkinson').length),
      otherPps: modeledRange(movers.filter((h) => h.school !== null && h.school !== 'atkinson').length),
      leftPps: modeledRange(movers.filter((h) => h.school === null).length),
    });
  });

  it('counts its movers in the flows', () => {
    const f = report.flows;
    expect(f.movedWithinPps).toBeGreaterThan(quo.report.flows.movedWithinPps + 80);
    expect(f.stayed + f.movedWithinPps + f.cameBack + f.enteredK).toBe(next.dials.kids);
  });

  it('tells the Bulletin about blocks, never a school', () => {
    const summer = report.events.find((e) => e.title === 'Boundaries change')!;
    expect(summer.detail).toMatch(/^60 blocks of 250 m change zones/);
    for (const e of report.events) expect(e.detail).not.toMatch(/Creston|Atkinson/);
  });

  it('is deterministic and leaves the ghost alone', () => {
    const again = play(edit);
    expect(again.next.households).toEqual(next.households);
    expect(again.report).toEqual(report);
    const strip = (s: GameState) => ({ ...s, sim: { ...s.sim!, ghost: undefined } });
    expect(strip(next.sim!.ghost!)).toEqual(strip(quo.next.sim!.ghost!));
  });
});

describe('re-zoned kids who must choose', () => {
  it('keeps a crowded new zone school at 110% of its seats', () => {
    const edit = sliceEdit(start, 'elementary', 'atkinson', 'creston', 100, false);
    const { next } = play(edit);
    const line = Math.floor(M.crowdingLine * start.schools.creston.capacity);
    expect(start.schools.creston.enrollment + boundaryChip(start, edit, DEFAULT_POLICY).kidsMoving).toBeGreaterThan(line);
    expect(next.schools.creston.enrollment).toBeLessThanOrEqual(line);
    expect(next.households.filter((h) => h.movedFrom === 'atkinson' && h.school !== null && h.school !== 'creston').length).toBeGreaterThan(50);
  });

  it('lets only kids who leave PPS for good move away, not charter kids', () => {
    const far = start.households.filter((h) => h.school !== null && gradeOf(h) < 5).slice(0, 4000);
    const movers = far.map((h) => ({
      before: { ...h, pos: [1e7, 1e7] as [number, number] },
      next: { ...h, kids: h.kids, school: null },
      region: null,
    }));
    const flows = { stayed: 0, movedWithinPps: 0, leftPps: 0, cameBack: 0, enteredK: 0, graduated: 0 };
    const tally = decideRezoned({ seed: 1, year: 2027, closed: new Set(), movers, households: [], flows });
    const away = movers.filter((m) => m.next.movedAway).length / tally.left;
    const leaveForGood = 1 - M.nonFollowerOtherPps - M.nonFollowerCharter;
    expect(tally.zoneSchool).toBe(0);
    expect(away).toBeCloseTo((M.awayShare * leaveForGood) / (leaveForGood + M.nonFollowerCharter), 1);
  });
});

describe('a block moved back to the school its kids kept', () => {
  it('moves none of the grandfathered kids', () => {
    const away = sliceEdit(start, 'elementary', 'creston', 'atkinson', 30, true);
    const year1 = play(away).next;
    const back: BoundaryEdit = { ...away, to: 'creston', grandfather: false };
    const year2 = endYear(year1, { ...DEFAULT_POLICY, boundaryEdits: [back] }).next;
    const kept = year1.households.filter(inCells(away)).filter((h) => h.school === 'creston' && gradeOf(h) < 5);
    expect(kept.length).toBeGreaterThan(20);
    const later = new Map(year2.households.map((h) => [h.id, h]));
    expect(kept.filter((h) => later.get(h.id)?.movedFrom === 'creston')).toEqual([]);
  });
});

describe('rezoneFactors', () => {
  const h = start.households.find((x) => x.school === 'creston')!;

  it('counts a kid moved before as moved twice', () => {
    const once = followChance(M.sliceStay, rezoneFactors(h, 'atkinson'));
    const twice = followChance(M.sliceStay, rezoneFactors({ ...h, forcedMoves: 1 }, 'atkinson'));
    expect(once - twice).toBeCloseTo(M.followMovedTwice);
    expect(rezoneFactors(h, 'atkinson').wholeClasses).toBe(false);
  });
});

describe('a middle-school boundary edit', () => {
  const edit = sliceEdit(start, 'middle', 'hosford', 'sellwood', 30, false);
  const { next } = play(edit);

  it('zones every grade 6-8 kid in the blocks to the new middle school', () => {
    const kids = next.households.filter(inCells(edit)).filter((h) => gradeOf(h) >= 6);
    expect(kids.length).toBeGreaterThan(20);
    for (const h of kids) expect(h.zoneSchool).toBe('sellwood');
    expect(next.households.filter(inCells(edit)).filter((h) => gradeOf(h) >= 7 && h.school === 'hosford' && !h.movedFrom)).toEqual([]);
  });

  it('counts its blocks for the Bulletin', () => {
    const summer = play(edit).report.events.find((e) => e.title === 'Boundaries change')!;
    expect(summer.detail).toMatch(new RegExp(`^${edit.cells.length} blocks`));
  });

  it("grandfathers only some kids when only some edits say so", () => {
    const gf = sliceEdit(start, 'elementary', 'creston', 'atkinson', 20, true);
    const report = endYear(start, { ...DEFAULT_POLICY, boundaryEdits: [gf, edit] }).report;
    expect(report.events.find((e) => e.title === 'Boundaries change')!.detail).toContain('Some current students');
  });

  it('leaves K-5 zones alone', () => {
    for (const c of edit.cells) expect(next.zones.elementary[c]).toBe(start.zones.elementary[c]);
  });
});

describe('walk and buses', () => {
  /** Rieke's homes nearest Maplewood ride past the walk limit. */
  const edit = sliceEdit(start, 'elementary', 'rieke', 'maplewood', 40, false);
  const chip = boundaryChip(start, edit, DEFAULT_POLICY);
  const year1 = play(edit);
  const year2 = endYear(year1.next, DEFAULT_POLICY);

  it('lowers the Walk dial when kids move farther from school', () => {
    expect(chip.walk).toBeLessThan(-30);
    expect(year1.next.dials.walkK5).toBeLessThan(quo.next.dials.walkK5 - 30);
    expect(year1.next.dials.newBusRiders).toBeGreaterThan(30);
    expect(quo.next.dials.newBusRiders).toBe(0);
    expect(start.dials.newBusRiders).toBe(0);
  });

  it('charges each new rider this year and gets 70-90% back from the state the next', () => {
    expect(chip.riders.now).toBeGreaterThan(30);
    const busing = line(year1.report.budget, 'busing');
    expect(busing).toBeCloseTo(-chip.riders.now * 1_400, 0);
    expect(line(year1.report.budget, 'busReimbursement')).toBe(0);
    expect(line(previewBudget(start, { ...DEFAULT_POLICY, boundaryEdits: [edit] }), 'busing')).toBe(busing);
    expect(line(year1.next.budget, 'busReimbursement')).toBeCloseTo(-0.8 * busing, 0);
    expect(line(year1.next.budget, 'busing')).toBeLessThan(0);
    expect(line(year2.report.budget, 'busReimbursement')).toBeCloseTo(-0.8 * busing, 0);
  });

  it.each([true, false])("projects next fall's riders as if every kid stays, kindergartners included, when grandfather is %s", (grandfather) => {
    const lent = sliceEdit(start, 'elementary', 'lent', 'chapman', 100, grandfather);
    const projected = boundaryChip(start, lent, DEFAULT_POLICY).riders.now;
    const actual = play(lent).next.dials.newBusRiders;
    expect(actual).toBeGreaterThan(15);
    expect(projected).toBeGreaterThanOrEqual(0.8 * actual);
    expect(projected).toBeLessThanOrEqual(1.3 * actual);
  });

  it('books year-2 busing at year-2 prices', () => {
    const b = year1.next.budget;
    const { closed } = year1.next.sim!;
    const zoning = zoningYear(year1.next.zones, closed, [], homesByCell(year1.next.households));
    const riders = projectRiders(year1.next.households, zoning, closed, new Set());
    expect(riders).toBeGreaterThan(30);
    expect(line(b, 'busing')).toBeCloseTo(-riders * 1_400 * costIndex(2028), 0);
  });

  it("counts the state's repayment as revenue, so it doesn't lower spending", () => {
    const noCuts = { ...DEFAULT_POLICY, levyRate: 5 };
    const repaid = previewBudget({ ...start, sim: { ...start.sim!, busing: 1_000_000 } }, noCuts);
    const none = previewBudget(start, noCuts);
    expect(repaid.autoCutPositions + none.autoCutPositions).toBe(0);
    expect(line(repaid, 'busReimbursement')).toBe(800_000);
    expect(repaid.spending).toBeCloseTo(none.spending, 0);
  });

  it('charges buses for kids a closure re-zones', () => {
    const peninsula = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const };
    expect(line(previewBudget(start, { ...DEFAULT_POLICY, closures: [peninsula] }), 'busing')).toBeLessThan(0);
  });

  it('books no buses without a change', () => {
    expect(line(quo.report.budget, 'busing')).toBe(0);
    expect(line(quo.next.budget, 'busReimbursement')).toBe(0);
  });
});

describe('boundaryChip', () => {
  it('prices buses now gross and at maturity net of the repayment', () => {
    const edit = sliceEdit(start, 'elementary', 'rieke', 'maplewood', 40, false);
    const chip = boundaryChip(start, edit, DEFAULT_POLICY);
    const { now, atMaturity } = chip.riders;
    expect(chip.now).toEqual({ lo: -now * 1_800 * costIndex(2027), hi: -now * 1_000 * costIndex(2027) });
    expect(chip.atMaturity.lo).toBeCloseTo(-atMaturity * 1_800 * 0.3);
    expect(chip.atMaturity.hi).toBeCloseTo(-atMaturity * 1_000 * 0.1);
    expect(atMaturity).toBeGreaterThanOrEqual(now);
  });

  it('shows seats before and after as ranges, shifted by the kids who must move', () => {
    const edit = nearCreston(false);
    const chip = boundaryChip(start, edit, DEFAULT_POLICY);
    expect(chip.kidsMoving).toBeGreaterThan(20);
    const at = (s: string) => chip.seats.find((x) => x.school === s)!;
    expect(at('creston').before).toEqual(modeledRange(start.schools.creston.enrollment));
    expect(at('creston').after).toEqual(modeledRange(start.schools.creston.enrollment - chip.kidsMoving));
    expect(at('atkinson').after).toEqual(modeledRange(start.schools.atkinson.enrollment + chip.kidsMoving));
    expect(at('atkinson').capacity).toBe(start.schools.atkinson.capacity);
    expect(chip.residents).toBe(start.households.filter(inCells(edit)).length);
  });

  it('moves no one now when grandfathered, but still shows the walk at maturity', () => {
    const chip = boundaryChip(start, nearCreston(true), DEFAULT_POLICY);
    const full = boundaryChip(start, nearCreston(false), DEFAULT_POLICY);
    expect(chip.kidsMoving).toBe(0);
    for (const s of chip.seats) expect(s.after).toEqual(s.before);
    expect(chip.walk).toBe(full.walk);
    expect(chip.walk).toBeLessThan(0);
    expect(chip.riders.now).toBeLessThan(full.riders.now);
  });

  it('flags blocks that do not touch the new zone', () => {
    const far = sliceEdit(start, 'elementary', 'forest-park', 'forest-park', 10, false);
    expect(boundaryChip(start, { ...far, to: 'atkinson' }, DEFAULT_POLICY).contiguous).toBe(false);
    expect(boundaryChip(start, nearCreston(false), DEFAULT_POLICY).contiguous).toBe(true);
  });

  it("leaves a closing school's kids to the closure", () => {
    const peninsula = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const };
    const cells = sliceCells(start, 'elementary', 'peninsula', 'chief-joseph', 50);
    const edit: BoundaryEdit = { level: 'elementary', to: 'chief-joseph', cells, grandfather: false };
    expect(start.households.filter((h) => cells.includes(h.cell) && h.school === 'peninsula').length).toBeGreaterThan(20);
    expect(boundaryChip(start, edit, { ...DEFAULT_POLICY, closures: [peninsula] }).kidsMoving).toBe(0);
  });

  it('shows no walk change for a middle edit, since Walk counts K-5', () => {
    expect(boundaryChip(start, sliceEdit(start, 'middle', 'hosford', 'sellwood', 30, false), DEFAULT_POLICY).walk).toBe(0);
  });

  it('counts only blocks the plan has not already moved', () => {
    const edit = nearCreston(false);
    expect(boundaryChip(start, edit, { ...DEFAULT_POLICY, boundaryEdits: [edit] }).kidsMoving).toBe(0);
  });
});

describe('boundary edits and closures', () => {
  const peninsula = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const };

  it('ignores an edit into a closing school', () => {
    const cells = sliceCells(start, 'elementary', 'chief-joseph', 'peninsula', 20);
    const edit: BoundaryEdit = { level: 'elementary', to: 'peninsula', cells, grandfather: false };
    const { next } = endYear(start, { ...DEFAULT_POLICY, closures: [peninsula], boundaryEdits: [edit] });
    for (const c of cells) expect(next.zones.elementary[c]).toBe('chief-joseph');
    expect(next.zones.elementary).not.toContain('peninsula');
  });

  it("re-zones a closed school's blocks in the zone map", () => {
    const { next } = endYear(start, { ...DEFAULT_POLICY, closures: [peninsula] });
    const blocks = start.zones.elementary.flatMap((s, c) => (s === 'peninsula' ? [c] : []));
    for (const c of blocks) expect(next.zones.elementary[c]).toBe('rosa-parks');
  });
});

describe('normalizePolicy', () => {
  it('tidies boundary edits like closures', () => {
    const cell = start.zones.elementary.indexOf('creston');
    const messy = { ...DEFAULT_POLICY, boundaryEdits: [{ level: 'elementary', to: 'atkinson', cells: [cell, cell, -3], grandfather: false } as BoundaryEdit] };
    expect(normalizePolicy(messy).boundaryEdits).toEqual([{ level: 'elementary', to: 'atkinson', cells: [cell], grandfather: false }]);
  });
});
