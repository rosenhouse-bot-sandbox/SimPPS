import { SCHOOLS, type Point } from '../data';
import { miles, schoolPos } from './closures';
import { topGrade, type Shut } from './gradeSpan';
import { M } from './model';
import { apportion, SCHOOL_INFO } from './population';
import { modeledRange } from './range';
import { draw } from './rng';
import type { Closure, Household, MovedProgram, Program, ProgramMove, ProgramMoveOutcome, SchoolId, SchoolState } from './types';

/** PPS's data calls Mandarin immersion "Chinese", so the game renames it. */
const LANGUAGES: Record<string, Program> = {
  Spanish: 'Spanish',
  Chinese: 'Mandarin',
  Japanese: 'Japanese',
  Russian: 'Russian',
  Vietnamese: 'Vietnamese',
};
const PROGRAMS = new Set(Object.values(LANGUAGES));

/** Returns the program a data language names. */
export function language(name: string): Program {
  const p = LANGUAGES[name.trim()];
  if (!p) throw new Error(`Unknown DLI language ${name}`);
  return p;
}

/** Lists each school's DLI programs in fall 2025. */
export const DLI_PROGRAMS: ReadonlyMap<SchoolId, Program[]> = new Map(
  SCHOOLS.flatMap((s) => (s.dliLanguages ? [[s.id, s.dliLanguages.split(';').map(language)]] : [])),
);

/** model.dli: a two-language school splits its DLI kids evenly. */
function dliSplit(school: SchoolId, n: number): [Program, number][] {
  const programs = DLI_PROGRAMS.get(school) ?? [];
  const split = apportion(n, programs.map(() => 1));
  return programs.map((p, i) => [p, split[i]]);
}

/** model.dli: this holds the share of each school's fall 2025 kids in each program. */
const DLI_SHARE: ReadonlyMap<SchoolId, [Program, number][]> = new Map(
  SCHOOLS.flatMap((s) => (s.dliStudents && s.enrollment ? [[s.id, dliSplit(s.id, s.dliStudents).map(([p, n]) => [p, n / s.enrollment!])]] : [])),
);

/** Draw purposes for programs differ from the other sim files'. */
const D = { Assign: 60, Stay: 61, Entrant: 62 };

/** model.dli: a kindergartner who picks `school` joins one of its programs by the school's fall 2025 DLI shares. */
export function entrantProgram(seed: number, year: number, id: number, school: SchoolId): Program | undefined {
  const u = draw(seed, year, id, D.Entrant);
  let sum = 0;
  for (const [p, share] of DLI_SHARE.get(school) ?? []) if (u < (sum += share)) return p;
  return undefined;
}

/** model.dli: each school starts with its 2025-26 DLI count, or all its kids when fewer, picked by the seed. */
export function assignDli(households: Household[], seed: number): Household[] {
  const at = new Map<SchoolId, Household[]>();
  for (const h of households) {
    if (h.school === null) continue;
    const kids = at.get(h.school);
    if (kids) kids.push(h);
    else at.set(h.school, [h]);
  }
  const program = new Map<number, Program>();
  for (const school of DLI_PROGRAMS.keys()) {
    const kids = (at.get(school) ?? []).map((h) => ({ h, u: draw(seed, h.id, 0, D.Assign) })).sort((a, b) => a.u - b.u);
    const n = Math.min(SCHOOL_INFO.get(school)!.data.dliStudents ?? 0, kids.length);
    let k = 0;
    for (const [p, m] of dliSplit(school, n)) for (let j = 0; j < m; j++) program.set(kids[k++].h.id, p);
  }
  return households.map(({ program: _, ...h }) => (program.has(h.id) ? { ...h, program: program.get(h.id)! } : h));
}

/** Lists the programs each school offers after `moves`. */
export function programsAt(moves: readonly ProgramMove[]): Map<SchoolId, Set<Program>> {
  const at = new Map([...DLI_PROGRAMS].map(([s, ps]) => [s, new Set(ps)]));
  for (const m of moves) {
    for (const f of m.from) at.get(f)?.delete(m.program);
    at.set(m.to, (at.get(m.to) ?? new Set()).add(m.program));
  }
  return at;
}

/** model.dli: a DLI kid moving up to middle school goes to its feeder if that offers the program, else the nearest school that does. */
export function dliPathway(
  program: Program,
  feeder: SchoolId,
  pos: Point,
  grade: number,
  offered: ReadonlyMap<SchoolId, ReadonlySet<Program>>,
  shut: Shut,
): SchoolId | null {
  if (offered.get(feeder)?.has(program)) return feeder;
  let best: SchoolId | null = null;
  let bestMiles = Infinity;
  for (const [id, programs] of offered) {
    const info = SCHOOL_INFO.get(id)!;
    if (!programs.has(program) || shut.has(id, grade) || grade < info.lo || grade > info.hi) continue;
    const d = miles(pos, schoolPos(id));
    if (d < bestMiles) [best, bestMiles] = [id, d];
  }
  return best;
}

/** Follows a school's program through its moves to where it is now. */
export function programSite(moves: readonly ProgramMove[], school: SchoolId, program: Program): SchoolId {
  for (const m of moves) if (m.program === program && m.from.includes(school)) school = m.to;
  return school;
}

/** Returns where a kindergartner who picks `school` joins `program`, or null when the program has no open home. */
export function entrantSite(
  moves: readonly ProgramMove[],
  offered: ReadonlyMap<SchoolId, ReadonlySet<Program>>,
  shut: Shut,
  school: SchoolId,
  program: Program,
): SchoolId | null {
  const site = programSite(moves, school, program);
  return !shut.has(site, 0) && offered.get(site)?.has(program) ? site : null;
}

/** Checks that `id` serves every grade `school` serves. */
function servesAll(id: SchoolId, school: SchoolId, k5: { has(id: SchoolId): boolean }): boolean {
  return SCHOOL_INFO.get(id)!.lo <= SCHOOL_INFO.get(school)!.lo && topGrade(id, k5) >= topGrade(school, k5);
}

/**
 * model.programMove: a closing school's programs move with it unless the plan moves them elsewhere.
 * Each goes to the largest receiver if it serves the school's grades, else to the nearest open school that does.
 */
export function closurePrograms(
  schools: Record<SchoolId, SchoolState>,
  closures: readonly Closure[],
  moves: readonly ProgramMove[],
  k5: { has(id: SchoolId): boolean } = { has: (id) => !!schools[id]?.converted },
): ProgramMove[] {
  const moved = new Set(moves.flatMap((m) => m.from.map((f) => `${m.program} ${f}`)));
  const closing = new Set(closures.map((c) => c.school));
  const host = (c: Closure): SchoolId | null => {
    const [largest] = [...c.receivers].sort((a, b) => b.share - a.share);
    if (largest && servesAll(largest.school, c.school, k5)) return largest.school;
    let best: SchoolId | null = null;
    let bestMiles = Infinity;
    for (const [id, info] of SCHOOL_INFO) {
      if (!schools[id]?.open || closing.has(id) || info.k8 === 0 || !servesAll(id, c.school, k5)) continue;
      const d = miles(schoolPos(c.school), schoolPos(id));
      if (d < bestMiles) [best, bestMiles] = [id, d];
    }
    return best;
  };
  return closures.flatMap((c) =>
    (Object.keys(schools[c.school]?.dli ?? {}) as Program[]).flatMap((program) => {
      const to = moved.has(`${program} ${c.school}`) ? null : host(c);
      return to ? [{ program, from: [c.school], to }] : [];
    }),
  );
}

/** Moves each from-school's program kids to the receiver, spread over the from-school's grades. */
export function withProgramArrivals(schools: Record<SchoolId, SchoolState>, moves: readonly ProgramMove[]): Record<SchoolId, SchoolState> {
  const out = { ...schools };
  for (const m of moves)
    for (const f of m.from) {
      const n = Math.min(out[f].dli?.[m.program] ?? 0, out[f].enrollment);
      const byGrade = apportion(n, out[f].byGrade);
      const shift = (s: SchoolState, sign: number): SchoolState => ({
        ...s,
        byGrade: s.byGrade.map((k, g) => k + sign * byGrade[g]),
        enrollment: s.enrollment + sign * n,
      });
      out[f] = shift(out[f], -1);
      out[m.to] = shift(out[m.to], 1);
    }
  return out;
}

/** Keeps moves of a known program into a known school the plan doesn't close, one per program and school. */
export function normalizeProgramMoves(moves: readonly ProgramMove[], closures: readonly Closure[]): ProgramMove[] {
  const closing = new Set(closures.map((c) => c.school));
  const seen = new Set<string>();
  return moves.flatMap(({ program, from, to }) => {
    if (!PROGRAMS.has(program) || !SCHOOL_INFO.has(to) || closing.has(to)) return [];
    const kept = from.filter((f) => SCHOOL_INFO.has(f) && f !== to && !seen.has(`${program} ${f}`) && seen.add(`${program} ${f}`));
    return kept.length ? [{ program, from: kept, to }] : [];
  });
}

/** Keeps the moves that can happen this summer: from open schools offering the program into an open school. */
export function effectiveProgramMoves(schools: Record<SchoolId, SchoolState>, moves: readonly ProgramMove[]): ProgramMove[] {
  return moves.flatMap((m) => {
    if (!schools[m.to]?.open) return [];
    const from = m.from.filter((f) => schools[f]?.open && m.program in (schools[f].dli ?? {}));
    return from.length ? [{ ...m, from }] : [];
  });
}

/** model.programMove: a kid follows its program less often when the new school is far from home. */
export function programStay(pos: Point, to: SchoolId): number {
  return M.programMoveStay - M.programStayPerMile * Math.max(0, miles(pos, schoolPos(to)) - M.programFarMiles);
}

/** Draws a mover's dice for following its program. */
export function programMoveDraw(seed: number, year: number, id: number): number {
  return draw(seed, year, id, D.Stay);
}

export interface ProgramTally extends MovedProgram {
  arrived: number;
  /** Kids who didn't follow, as they are this fall. */
  stayers: Household[];
}

/**
 * Builds the report's "where kids went" for this year's program moves, as ranges. Non-followers that a
 * closure, grade-span change or boundary change moved count in those sections instead.
 */
export function programMoveOutcomes(tallies: readonly ProgramTally[]): ProgramMoveOutcome[] {
  return tallies.map(({ program, from, to, arrived, stayers }) => {
    const own = stayers.filter((h) => h.movedFrom === undefined);
    const left = own.filter((h) => h.school === null).length;
    const kids = arrived + own.length;
    return {
      program,
      from,
      to,
      kids: modeledRange(kids),
      receiver: modeledRange(arrived),
      leftDli: modeledRange(kids - arrived - left),
      leftPps: modeledRange(left),
    };
  });
}
