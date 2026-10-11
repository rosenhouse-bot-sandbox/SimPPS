import { clamp } from '../clamp';
import { SCHOOLS, ZONES, type Point, type SchoolData } from '../data';
import { samplePoint, ZoneIndex } from './geo';
import { cellAt } from './grid';
import { M, MAX_GRADE, oneKid } from './model';
import { stream } from './rng';
import type { Household, SchoolChoice as Choice, SchoolId } from './types';

export interface SchoolInfo {
  data: SchoolData;
  /** The K-8 grades the school serves. */
  lo: number;
  hi: number;
  /** Simulated kids in fall 2025. */
  k8: number;
  /** High schoolers, held fixed outside the simulation. */
  highSchoolers: number;
  elemZone: number;
  middleZone: number;
}

export const ELEM = new ZoneIndex(ZONES.elementary);
export const MIDDLE = new ZoneIndex(ZONES.middle);

/** model.altPrograms */
function altGrades(data: SchoolData): Pick<SchoolInfo, 'lo' | 'hi' | 'k8' | 'highSchoolers'> {
  const total = data.enrollment ?? 0;
  if (data.id === 'alliance') return { lo: 0, hi: MAX_GRADE, k8: 0, highSchoolers: total };
  if (data.id === 'access-academy') return { lo: 1, hi: MAX_GRADE, k8: data.forecast['2026'] ?? 0, highSchoolers: 0 };
  const k8 = Math.round((total * 9) / 13);
  return { lo: 0, hi: MAX_GRADE, k8, highSchoolers: total - k8 };
}

export const SCHOOL_INFO: Map<SchoolId, SchoolInfo> = new Map(
  SCHOOLS.map((data) => {
    const elemZone = ZONES.elementary.findIndex((z) => z.school === data.id);
    const middleZone = ZONES.middle.findIndex((z) => z.school === data.id);
    const grades =
      data.level === 'ALT'
        ? altGrades(data)
        : {
            lo: data.level === 'MS' ? 6 : 0,
            hi: data.level === 'K5' && middleZone < 0 ? 5 : MAX_GRADE,
            k8: data.enrollment ?? 0,
            highSchoolers: 0,
          };
    return [data.id, { data, ...grades, elemZone, middleZone }];
  }),
);

/** model.altPrograms: zoneless programs that start past kindergarten take their entry grade from across the city. */
export const CITYWIDE_INTAKE = [...SCHOOL_INFO.values()]
  .filter((i) => i.elemZone < 0 && i.middleZone < 0 && i.lo > 0 && i.lo < 6 && i.k8 > 0)
  .map((i) => ({ school: i.data.id, grade: i.lo, kids: Math.round(i.k8 / (i.hi - i.lo + 1)) }));

const MIDDLE_SCHOOLS = SCHOOLS.filter((s) => s.level === 'MS');
const MEDIAN_DIRECT_CERT = median(SCHOOLS.map((s) => s.pctDirectCert).filter((x): x is number => x !== null));

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function directCert(school: SchoolId): number {
  return SCHOOL_INFO.get(school)?.data.pctDirectCert ?? MEDIAN_DIRECT_CERT;
}

export function pick(choice: Choice, u: number): SchoolId {
  const x = u * choice.cum[choice.cum.length - 1];
  const i = choice.cum.findIndex((c) => x < c);
  return choice.ids[i < 0 ? choice.ids.length - 1 : i];
}

function toChoice(counts: Map<SchoolId, number>): Choice {
  const ids = [...counts.keys()].sort();
  let sum = 0;
  return { ids, cum: ids.map((id) => (sum += counts.get(id)!)) };
}

const middleZoneAt = new Map<number, number>();

/** MIDDLE.find, remembered by position, since homes never move. */
function findMiddle(pos: Point): number {
  const key = pos[0] * 1e6 + pos[1];
  let m = middleZoneAt.get(key);
  if (m === undefined) middleZoneAt.set(key, (m = MIDDLE.find(pos)));
  return m;
}

/** The middle school a home is zoned to. */
export function middleZoneSchool(pos: Point, elemZoneSchool: SchoolId): SchoolId {
  const m = findMiddle(pos);
  if (m >= 0) return ZONES.middle[m].school;
  if (SCHOOL_INFO.get(elemZoneSchool)!.hi === MAX_GRADE) return elemZoneSchool;
  let best = MIDDLE_SCHOOLS[0];
  for (const s of MIDDLE_SCHOOLS)
    if ((s.x - pos[0]) ** 2 + (s.y - pos[1]) ** 2 < (best.x - pos[0]) ** 2 + (best.y - pos[1]) ** 2) best = s;
  return best.id;
}

export function zonedSchool(pos: Point, elemZone: number, grade: number): SchoolId {
  const elem = ZONES.elementary[elemZone].school;
  return grade <= 5 ? elem : middleZoneSchool(pos, elem);
}

/** Largest-remainder split of n by weights. */
export function apportion(n: number, weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total > 0 ? (n * w) / total : 0));
  const out = raw.map(Math.floor);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0, left = n - out.reduce((a, b) => a + b, 0); k < left; k++) out[order[k][1]]++;
  return out;
}

/** model.exitCapacity */
export function exitCapacityFor(zoneSchool: SchoolId, u: number): number {
  return clamp(1 - directCert(zoneSchool) / M.directCertForZeroExit + (u - 0.5) * 0.2, 0.02, 0.98);
}

/** model.voice */
export function voiceFor(exitCapacity: number, u: number): number {
  return clamp(0.1 + 0.4 * exitCapacity + (u - 0.5) * 0.2, 0, 1);
}

export interface Population {
  households: Household[];
  /** Per elementary zone: where its K-5 PPS kids go. */
  kChoice: Choice[];
  /** Citywide mix of middle schools, for grade-6 kids who skip the feeder. */
  msMix: Choice;
  /** Per elementary zone: share of its PPS K-5 kids at the zone school. */
  zoneKeep: number[];
  /** Per elementary zone: resident kindergartners in and out of PPS. */
  kCohort: number[];
  /** Per elementary zone: share of resident kindergartners in PPS. */
  kCapture: number[];
}

export function generatePopulation(seedHash: number): Population {
  const rand = stream(seedHash);
  const zoneWeight = ZONES.elementary.map((z) => SCHOOL_INFO.get(z.school)?.data.enrollment ?? 0);
  const zoneCum: number[] = [];
  zoneWeight.reduce((sum, w, i) => (zoneCum[i] = sum + w), 0);
  const randomZone = () => {
    const x = rand() * zoneCum[zoneCum.length - 1];
    return zoneCum.findIndex((c) => x < c);
  };

  const homes: { pos: Point; elemZone: number; grade: number; school: SchoolId | null }[] = [];

  for (const s of SCHOOLS) {
    const info = SCHOOL_INFO.get(s.id)!;
    const span = info.hi - info.lo + 1;
    const byGrade = apportion(
      info.k8,
      Array.from({ length: span }, (_, i) => 1 + M.gradeTilt * i),
    );
    const homeZone = info.lo === 6 ? info.middleZone : info.elemZone;
    const zones = info.lo === 6 ? ZONES.middle : ZONES.elementary;
    const share = s.hasFocusOption ? M.focusInZoneShare : M.inZoneShare;
    byGrade.forEach((n, i) => {
      for (let k = 0; k < n; k++) {
        let pos: Point | null = null;
        let elemZone = -1;
        if (homeZone >= 0 && rand() < share) {
          for (let tries = 0; tries < 20 && elemZone < 0; tries++) {
            pos = samplePoint(zones[homeZone], rand);
            elemZone = info.lo === 6 ? ELEM.find(pos) : homeZone;
          }
        }
        if (elemZone < 0) {
          elemZone = randomZone();
          pos = samplePoint(ZONES.elementary[elemZone], rand);
        }
        homes.push({ pos: pos!, elemZone, grade: info.lo + i, school: s.id });
      }
    });
  }

  const nz = ZONES.elementary.length;
  const residents = Array.from({ length: nz }, () => new Array<number>(MAX_GRADE + 1).fill(0));
  for (const h of homes) residents[h.elemZone][h.grade]++;
  const inByGrade = Array.from({ length: MAX_GRADE + 1 }, (_, g) => residents.reduce((a, r) => a + r[g], 0));
  const outK = Math.round((inByGrade[0] * (1 - M.kCapture2025)) / M.kCapture2025);
  const outByGrade = [outK, ...apportion(M.outsideKids - outK, inByGrade.slice(1))];
  const zoneExit = ZONES.elementary.map((z) => exitCapacityFor(z.school, 0.5));
  for (let g = 0; g <= MAX_GRADE; g++) {
    const perZone = apportion(
      outByGrade[g],
      residents.map((r, z) => r[g] * (0.5 + zoneExit[z])),
    );
    perZone.forEach((n, z) => {
      for (let k = 0; k < n; k++)
        homes.push({ pos: samplePoint(ZONES.elementary[z], rand), elemZone: z, grade: g, school: null });
    });
  }

  const kCounts = Array.from({ length: nz }, () => new Map<SchoolId, number>());
  const msCounts = new Map<SchoolId, number>();
  for (const h of homes) {
    if (h.school === null) continue;
    if (h.grade <= 5 && SCHOOL_INFO.get(h.school)!.lo === 0) kCounts[h.elemZone].set(h.school, (kCounts[h.elemZone].get(h.school) ?? 0) + 1);
    if (SCHOOL_INFO.get(h.school)!.lo === 6) msCounts.set(h.school, (msCounts.get(h.school) ?? 0) + 1);
  }
  const zoneKeep = kCounts.map((counts, z) => {
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    return total ? (counts.get(ZONES.elementary[z].school) ?? 0) / total : 0;
  });

  const households: Household[] = homes.map((h, id) => {
    const zoneSchool = zonedSchool(h.pos, h.elemZone, h.grade);
    const exitCapacity = exitCapacityFor(ZONES.elementary[h.elemZone].school, rand());
    return {
      id,
      pos: h.pos,
      cell: cellAt(h.pos, h.elemZone),
      kids: oneKid(h.grade),
      zoneSchool,
      school: h.school,
      exitCapacity,
      // model.loyalty
      loyalty: clamp(zoneKeep[h.elemZone] + (rand() - 0.5) * 0.2, 0, 1),
      voice: voiceFor(exitCapacity, rand()),
      status: h.school === null ? 'left' : 'stayed',
    };
  });

  const kCohort = new Array<number>(nz).fill(0);
  for (const h of homes) if (h.grade === 0) kCohort[h.elemZone]++;
  return {
    households,
    kChoice: kCounts.map(toChoice),
    msMix: toChoice(msCounts),
    zoneKeep,
    kCohort,
    kCapture: kCohort.map((n, z) => (n ? residents[z][0] / n : M.kCapture2025)),
  };
}
