import { describe, expect, it } from 'vitest';
import { SCHOOLS, ZONES } from '../data';
import { inZone } from './geo';
import { gradeOf, MAX_GRADE } from './model';
import { generatePopulation, SCHOOL_INFO } from './population';

const pop = generatePopulation(123);
const inPps = pop.households.filter((h) => h.school !== null);
const outside = pop.households.filter((h) => h.school === null);

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

describe('generatePopulation', () => {
  it('gives each household one kid in K-8', () => {
    for (const h of pop.households) {
      expect(h.kids).toHaveLength(MAX_GRADE + 1);
      expect(h.kids.reduce((a, b) => a + b, 0)).toBe(1);
    }
  });

  it('matches every K-8 school total from fall 2025', () => {
    const counts = new Map<string, number>();
    for (const h of inPps) counts.set(h.school!, (counts.get(h.school!) ?? 0) + 1);
    for (const s of SCHOOLS) if (s.level !== 'ALT') expect(counts.get(s.id) ?? 0).toBe(s.enrollment ?? 0);
  });

  it('simulates only the K-8 grades of alternative programs', () => {
    const count = (id: string) => inPps.filter((h) => h.school === id).length;
    expect(count('alliance')).toBe(0);
    expect(SCHOOL_INFO.get('alliance')!.highSchoolers).toBe(215);
    expect(count('metropolitan-learning-center')).toBe(190);
    expect(SCHOOL_INFO.get('metropolitan-learning-center')!.highSchoolers).toBe(85);
    expect(count('access-academy')).toBe(315);
    expect(SCHOOL_INFO.get('access-academy')).toMatchObject({ lo: 1, hi: 8 });
    expect(inPps).toHaveLength(26_966 - 215 - 85 + 315);
  });

  it('never offers a kindergarten seat at a school without kindergarten', () => {
    for (const c of pop.kChoice) {
      expect(c.ids).not.toContain('alliance');
      expect(c.ids).not.toContain('access-academy');
    }
  });

  it('keeps kids inside their school grade span', () => {
    for (const h of inPps) {
      const info = SCHOOL_INFO.get(h.school!)!;
      const g = gradeOf(h);
      expect(g).toBeGreaterThanOrEqual(info.lo);
      expect(g).toBeLessThanOrEqual(info.hi);
    }
    expect(SCHOOL_INFO.get('beaumont')).toMatchObject({ lo: 6, hi: 8 });
    expect(SCHOOL_INFO.get('rosa-parks')).toMatchObject({ lo: 0, hi: 5 });
    expect(SCHOOL_INFO.get('beverly-cleary')).toMatchObject({ lo: 0, hi: 8 });
  });

  it('places about 8,000 resident kids outside PPS', () => {
    expect(Math.abs(outside.length - 8_000)).toBeLessThan(50);
  });

  it('places homes inside elementary zones and zones them to that school', () => {
    for (const h of pop.households.slice(0, 2000)) {
      if (gradeOf(h) > 5) continue;
      const zone = ZONES.elementary.find((z) => z.school === h.zoneSchool)!;
      expect(inZone(h.pos, zone)).toBe(true);
    }
  });

  it('houses most middle-school kids in that school middle zone', () => {
    const zone = ZONES.middle.find((z) => z.school === 'beaumont')!;
    const kids = inPps.filter((h) => h.school === 'beaumont');
    const home = kids.filter((h) => inZone(h.pos, zone)).length;
    expect(home / kids.length).toBeGreaterThan(0.7);
    for (const h of kids.filter((k) => inZone(k.pos, zone))) expect(h.zoneSchool).toBe('beaumont');
  });

  it('gives low direct-cert zones more exit capacity', () => {
    const exit = (school: string) => mean(pop.households.filter((h) => h.zoneSchool === school).map((h) => h.exitCapacity));
    expect(exit('maplewood')).toBeGreaterThan(exit('rosa-parks') + 0.4);
  });

  it('gives zones that keep their kids more loyalty', () => {
    const loyalty = (school: string) => mean(pop.households.filter((h) => h.zoneSchool === school).map((h) => h.loyalty));
    const keep = (school: string) => {
      const zoned = inPps.filter((h) => h.zoneSchool === school && gradeOf(h) <= 5);
      return zoned.filter((h) => h.school === school).length / zoned.length;
    };
    const [a, b] = ['maplewood', 'creston'].sort((x, y) => keep(x) - keep(y));
    expect(loyalty(b)).toBeGreaterThan(loyalty(a));
  });

  it('raises voice with exit capacity', () => {
    const rich = pop.households.filter((h) => h.exitCapacity > 0.8);
    const poor = pop.households.filter((h) => h.exitCapacity < 0.3);
    expect(mean(rich.map((h) => h.voice))).toBeGreaterThan(mean(poor.map((h) => h.voice)));
  });

  it('starts kindergarten capture near 74%', () => {
    const k = pop.households.filter((h) => gradeOf(h) === 0);
    const captured = k.filter((h) => h.school !== null).length / k.length;
    expect(captured).toBeCloseTo(0.74, 2);
  });

  it('is deterministic per seed', () => {
    const again = generatePopulation(123);
    expect(again.households.slice(0, 50)).toEqual(pop.households.slice(0, 50));
    expect(generatePopulation(124).households[0].pos).not.toEqual(pop.households[0].pos);
  });
});
