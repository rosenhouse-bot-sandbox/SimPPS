import { describe, expect, it } from 'vitest';
import { headlines, seasonEvents, versusGhost } from './report';
import type { YearFacts } from './step';
import type { Budget, Dials } from './types';

const plan: Budget = {
  lines: [],
  gap: -65_200_000,
  reserveDraw: 0,
  autoCutPositions: 421,
  spending: 827_000_000,
  reserves: 41_100_000,
  reservePct: 0.048,
  reservesAfter: 41_100_000,
  reservePctAfterDraw: 0.05,
  midYearCuts: 0,
};

const facts: YearFacts = {
  plan,
  reserveDraw: 0,
  autoCuts: 421,
  midYearCuts: 0,
  kResidents: 3_870,
  kEnrolled: 2_935,
  graduates: 3_094,
  flows: { stayed: 22_800, movedWithinPps: 575, leftPps: 450, cameBack: 258, enteredK: 2_935, graduated: 3_094 },
  regions: new Map([
    ['North', { kids: 4_000, leavers: 60 }],
    ['Outer Southeast', { kids: 6_000, leavers: 150 }],
    ['Southwest', { kids: 3_000, leavers: 75 }],
  ]),
  k5Homerooms: 690,
  homeroomsCut: 85,
  blended: 137,
  crowded: 3,
  stateFundingGrowth: null,
  closing: [],
  closures: [],
  rezonedCells: { elementary: 0, middle: 0 },
  grandfathered: 'none',
  rezoned: { kids: 0, zoneSchool: 0, otherPps: 0, left: 0 },
};

const dials: Dials = {
  kids: 26_600,
  capture: 0.77,
  kindergartenCapture: 0.76,
  gap: -65_200_000,
  positionsCut: 0,
  reservePct: 0.048,
  kidsInUrm: 6_500,
  walkK5: 9_000,
  newBusRiders: 0,
};

const detail = (f: YearFacts, title: string) => seasonEvents(f).find((e) => e.title === title)!.detail;

describe('seasonEvents', () => {
  it('counts re-zoned blocks at both levels and names only the grades a grandfathered edit zones', () => {
    const at = (rezonedCells: YearFacts['rezonedCells'], grandfathered: YearFacts['grandfathered']) =>
      detail({ ...facts, rezonedCells, grandfathered }, 'Boundaries change');
    expect(at({ elementary: 3, middle: 0 }, 'all')).toBe(
      '3 blocks of 250 m change zones. Current students keep their schools; new kindergartners use the new zones.',
    );
    expect(at({ elementary: 0, middle: 1 }, 'all')).toBe(
      '1 block of 250 m changes zones. Current students keep their schools; new 6th graders use the new zones.',
    );
    expect(at({ elementary: 2, middle: 2 }, 'all')).toContain('4 blocks of 250 m change zones. Current students keep their schools; new kindergartners and 6th graders use');
    expect(at({ elementary: 2, middle: 0 }, 'none')).toBe('2 blocks of 250 m change zones. Kids in them get new zone schools.');
    expect(at({ elementary: 2, middle: 2 }, 'some')).toBe(
      '4 blocks of 250 m change zones. Some current students get new zone schools; the rest keep theirs.',
    );
    expect(seasonEvents(facts).some((e) => e.title === 'Boundaries change')).toBe(false);
  });

  it('reports the Legislature\'s vote in odd springs only', () => {
    const vote = seasonEvents({ ...facts, stateFundingGrowth: 0.042 }).find((e) => e.sourceKey === 'model.stateFunding')!;
    expect(vote.season).toBe('spring');
    expect(vote.title).toBe('Legislature sets state funding: +4.2%');
    expect(seasonEvents(facts).some((e) => e.sourceKey === 'model.stateFunding')).toBe(false);
  });

  it('formats money like the rest of the game', () => {
    expect(detail(facts, 'June budget closes with cuts')).toBe(
      'The gap is −$65.2M. Automatic cuts remove 421 positions by seniority and spare IEP services.',
    );
    expect(detail({ ...facts, reserveDraw: 1_000_000 }, 'June budget closes with cuts')).toContain(
      'Reserves cover $1M.',
    );
  });

  it('reports kindergarten capture, families and classes', () => {
    expect(detail(facts, 'Kindergarten lottery')).toBe(
      '~2,935 of ~3,870 resident kindergartners choose PPS (~76%).',
    );
    expect(detail(facts, 'Families decide')).toBe('~450 kids left PPS, ~258 came back and ~575 changed schools.');
    expect(detail(facts, 'Classes form')).toBe(
      '~137 of ~690 K-5 homerooms are blended. Cuts have taken ~85 homerooms, so classes run larger. 3 schools are over capacity.',
    );
  });

  it('closes schools in summer and tallies their kids in fall', () => {
    const closing = (school: string) => ({
      school,
      receivers: [{ school: 'rosa-parks', share: 1 }],
      building: 'mothball' as const,
      year: 2027,
      saving: 0,
      staffKept: 0,
    });
    const tally = (school: string, receiver: number, otherPps: number, left: number) => ({
      school,
      kids: receiver + otherPps + left,
      receivers: { 'rosa-parks': receiver },
      otherPps,
      left,
    });
    const f = {
      ...facts,
      closing: [closing('peninsula'), closing('woodmere')],
      closures: [tally('peninsula', 180, 12, 20), tally('woodmere', 150, 10, 30)],
    };
    expect(detail(f, '2 schools close')).toBe(
      'Peninsula Elementary School and Woodmere Elementary School close. Their buildings are mothballed.',
    );
    expect(detail(f, 'Families of the closed schools decide')).toBe('Their kids choose new schools. The report shows where they went.');
    expect(seasonEvents(f).length - seasonEvents(facts).length).toBe(2);
    const one = { ...f, closing: [closing('peninsula')], closures: [tally('peninsula', 180, 12, 20)] };
    expect(detail(one, '1 school closes')).toBe('Peninsula Elementary School closes. Its building is mothballed.');
    expect(detail(one, 'Families of the closed school decide')).toBe('Their kids choose new schools. The report shows where they went.');
    const mixed = { ...f, closing: [closing('peninsula'), { ...closing('woodmere'), building: 'sell' as const }] };
    expect(detail(mixed, '2 schools close')).toBe(
      'Peninsula Elementary School and Woodmere Elementary School close. Peninsula Elementary School is mothballed and Woodmere Elementary School is sold.',
    );
  });

  it('gives no counts for a closed school\'s families before the report', () => {
    const f = {
      ...facts,
      closing: [{ school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const, year: 2027, saving: 0, staffKept: 0 }],
      closures: [{ school: 'peninsula', kids: 212, receivers: { 'rosa-parks': 180 }, otherPps: 12, left: 20 }],
    };
    const fall = seasonEvents(f).filter((e) => e.season === 'fall' && e.title !== 'Families decide');
    expect(fall).toHaveLength(1);
    expect(fall[0].detail).not.toMatch(/\d/);
  });

  it('adds mid-year cuts only when they happen', () => {
    expect(seasonEvents(facts).some((e) => e.title === 'Mid-year cuts')).toBe(false);
    expect(detail({ ...facts, midYearCuts: 40 }, 'Mid-year cuts')).toBe(
      'Reserves fell below 3%, so 40 more positions go.',
    );
  });
});

describe('headlines', () => {
  const text = (f: YearFacts, before: Dials, after: Dials) => headlines(f, before, after).map((h) => h.text);

  it('reports cuts, enrollment and the region that lost the largest share', () => {
    expect(text(facts, dials, { ...dials, kids: 26_135 })).toEqual([
      'Cuts reach every school: 421 positions',
      'Enrollment falls to ~26,135',
      'Leavers run highest in Outer Southeast: ~2.5%',
    ]);
  });

  it('says when reserves cover the gap and enrollment rises', () => {
    const covered = { ...facts, autoCuts: 0, reserveDraw: 10_000_000 };
    const [money, kids] = text(covered, dials, { ...dials, kids: 26_700 });
    expect(money).toBe('Reserves cover the gap');
    expect(kids).toBe('Enrollment rises to ~26,700');
  });

  it('cites a registered kind of source for each headline', () => {
    expect(headlines(facts, dials, dials).map((h) => h.sourceKey)).toEqual([
      'model.autoCuts',
      'dial.kids',
      'model.movingRoll',
    ]);
  });
});

describe('versusGhost', () => {
  it('leaves out dials that match the ghost', () => {
    expect(versusGhost(dials, { ...dials, kids: dials.kids + 20 })).toEqual([]);
  });

  it('orders gaps by size in units of each dial and marks the better side', () => {
    const you = { ...dials, kids: 26_400, positionsCut: 200 };
    const ghost = { ...dials, kids: 26_600, positionsCut: 421 };
    expect(versusGhost(you, ghost)).toEqual([
      { dial: 'positionsCut', you: 200, ghost: 421, better: true },
      { dial: 'kids', you: 26_400, ghost: 26_600, better: false },
    ]);
  });
});
