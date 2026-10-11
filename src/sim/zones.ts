import { ZONES, type Point } from '../data';
import { nearestOpen, receiversFor, renormalize, schoolPos } from './closures';
import { inRing } from './geo';
import { CELL_METERS, zoneGrid, neighbors, type ZoneCell } from './grid';
import { middleZoneSchool, SCHOOL_INFO } from './population';
import type { BoundaryEdit, Closure, GameState, Household, SchoolId, ZoneLevel, ZoneMap } from './types';

export { CELL_METERS, cellAt, cellAtPoint, neighbors, zoneGrid, type ZoneCell, type ZoneGrid } from './grid';

export const LEVELS: ZoneLevel[] = ['elementary', 'middle'];

/** The first grade a level serves. */
export const ENTRY_GRADE: Record<ZoneLevel, number> = { elementary: 0, middle: 6 };

export function levelOf(grade: number): ZoneLevel {
  return grade <= 5 ? 'elementary' : 'middle';
}

const ZONE_SCHOOLS: Record<ZoneLevel, Set<SchoolId>> = {
  elementary: new Set(ZONES.elementary.map((z) => z.school)),
  middle: new Set(ZONES.middle.map((z) => z.school)),
};

function inRings(p: Point, rings: ZoneCell['rings']): boolean {
  let inside = false;
  for (const ring of rings) inside = inRing(p[0], p[1], ring) !== inside;
  return inside;
}

/** Middle zones' sorted ring crossings along the line at `y`, for even-odd tests. */
function crossings(y: number): { m: number; xs: number[] }[] {
  return ZONES.middle.flatMap((zone, m) => {
    const xs: number[] = [];
    for (const ring of zone.rings)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    return xs.length ? [{ m, xs: xs.sort((a, b) => a - b) }] : [];
  });
}

/** Like middleZoneSchool, with the line's crossings precomputed. */
function middleOnLine(p: Point, elem: SchoolId, line: { m: number; xs: number[] }[]): SchoolId {
  for (const { m, xs } of line) {
    let right = 0;
    for (let k = xs.length - 1; k >= 0 && xs[k] > p[0]; k--) right++;
    if (right % 2 === 1) return ZONES.middle[m].school;
  }
  return middleZoneSchool(p, elem);
}

const SAMPLES = 3;

/** Each cell's middle school: the one at most of a 3×3 sample of its points. */
function cellMiddles(cells: ZoneCell[], elementary: SchoolId[]): SchoolId[] {
  const step = CELL_METERS / SAMPLES;
  const lines = new Map<number, ReturnType<typeof crossings>>();
  const lineAt = (y: number) => lines.get(y) ?? lines.set(y, crossings(y)).get(y)!;
  return cells.map((c, id) => {
    const full = c.area > CELL_METERS ** 2 - 1;
    const counts = new Map<SchoolId, number>();
    for (let j = 0; j < SAMPLES; j++) {
      const y = Math.round(c.iy * CELL_METERS + (j + 0.5) * step);
      for (let i = 0; i < SAMPLES; i++) {
        const p: Point = [Math.round(c.ix * CELL_METERS + (i + 0.5) * step), y];
        if (!full && !inRings(p, c.rings)) continue;
        const m = middleOnLine(p, elementary[id], lineAt(y));
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
    }
    if (counts.size === 0) return middleZoneSchool(c.center, elementary[id]);
    return [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  });
}

let defaults: ZoneMap | undefined;

/** Today's zones. Don't mutate it. */
export function defaultZones(): ZoneMap {
  if (!defaults) {
    const { cells } = zoneGrid();
    const elementary = cells.map((c) => ZONES.elementary[c.elemZone].school);
    defaults = { elementary, middle: cellMiddles(cells, elementary) };
  }
  return defaults;
}

/**
 * A home's zone school at a level. A middle cell still on today's zone uses the home's own middle
 * zone, since a middle boundary can cross a cell.
 */
export function mappedZone(zones: ZoneMap, h: Pick<Household, 'cell' | 'pos'>, level: ZoneLevel, elem: SchoolId): SchoolId {
  if (level === 'elementary') return zones.elementary[h.cell];
  const m = zones.middle[h.cell];
  return m !== defaultZones().middle[h.cell] ? m : middleZoneSchool(h.pos, elem);
}

/** A home's zone school at a grade before any change. */
export function defaultZone(h: Pick<Household, 'cell' | 'pos'>, grade: number): SchoolId {
  const elem = defaultZones().elementary[h.cell];
  return grade <= 5 ? elem : middleZoneSchool(h.pos, elem);
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Closed schools' cells go to the receivers serving the level, split by share of area with nearer
 * cells to the nearer receiver, or to the nearest open school serving it.
 */
export function closeZones(zones: ZoneMap, closed: readonly Pick<Closure, 'school' | 'receivers'>[]): ZoneMap {
  if (closed.length === 0) return zones;
  const { cells } = zoneGrid();
  const shut = new Set(closed.map((c) => c.school));
  const out = { ...zones };
  for (const level of LEVELS) {
    const grade = ENTRY_GRADE[level];
    for (const c of closed) {
      const ids = out[level].flatMap((s, id) => (s === c.school ? [id] : []));
      if (ids.length === 0) continue;
      if (out[level] === zones[level]) out[level] = [...zones[level]];
      const map = out[level];
      const serving = renormalize(receiversFor(c, grade).filter((r) => !shut.has(r.school)));
      if (serving.length === 0) {
        for (const id of ids) map[id] = nearestOpen(cells[id].center, grade, shut);
        continue;
      }
      const [a, b] = serving.map((r) => schoolPos(r.school));
      const pull = (id: number) => (b ? dist(cells[id].center, a) - dist(cells[id].center, b) : 0);
      const sorted = ids.map((id) => ({ id, p: pull(id) })).sort((x, y) => x.p - y.p || x.id - y.id);
      const total = ids.reduce((s, id) => s + cells[id].area, 0);
      let acc = 0;
      for (const { id } of sorted) {
        map[id] = acc < serving[0].share * total ? serving[0].school : serving[serving.length - 1].school;
        acc += cells[id].area;
      }
    }
  }
  return out;
}

export function applyEdits(zones: ZoneMap, edits: readonly BoundaryEdit[]): ZoneMap {
  const out = { ...zones };
  for (const e of edits) {
    if (out[e.level] === zones[e.level]) out[e.level] = [...zones[e.level]];
    for (const c of e.cells) out[e.level][c] = e.to;
  }
  return out;
}

/**
 * Keeps edits into a zone school of their level, with valid cells. A cell belongs to its last edit
 * at a level. Edits left with no cells are dropped.
 */
export function normalizeBoundaryEdits(edits: readonly BoundaryEdit[]): BoundaryEdit[] {
  const n = zoneGrid().cells.length;
  const claimed: Record<ZoneLevel, Set<number>> = { elementary: new Set(), middle: new Set() };
  const out: BoundaryEdit[] = [];
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    if (!LEVELS.includes(e.level) || !ZONE_SCHOOLS[e.level].has(e.to)) continue;
    const taken = claimed[e.level];
    const cells = e.cells.filter((c) => Number.isInteger(c) && c >= 0 && c < n && !taken.has(c) && taken.add(c));
    if (cells.length) out.unshift({ level: e.level, to: e.to, cells, grandfather: !!e.grandfather });
  }
  return out;
}

/** Edits into open schools, kept to cells not already in the zone. */
export function effectiveEdits(zones: ZoneMap, edits: readonly BoundaryEdit[], shut: ReadonlySet<SchoolId>): BoundaryEdit[] {
  return edits.flatMap((e) => {
    const cells = e.cells.filter((c) => zones[e.level][c] !== e.to);
    return !shut.has(e.to) && cells.length ? [{ ...e, cells }] : [];
  });
}

/** Zones for a fall, and the cells whose zone an edit changed that summer. */
export interface ZoningYear {
  zones: ZoneMap;
  /** Changed cells by level, each with its edit's grandfather flag. */
  changed: Record<ZoneLevel, Map<number, boolean>>;
}

/** `closed` holds every closure in force this fall. Edits apply after closures re-zone. */
export function zoningYear(
  zones: ZoneMap,
  closed: readonly Pick<Closure, 'school' | 'receivers'>[],
  edits: readonly BoundaryEdit[],
): ZoningYear {
  const afterClosures = closeZones(zones, closed);
  const effective = effectiveEdits(afterClosures, edits, new Set(closed.map((c) => c.school)));
  const changed: ZoningYear['changed'] = { elementary: new Map(), middle: new Map() };
  for (const e of effective) for (const c of e.cells) changed[e.level].set(c, e.grandfather);
  return { zones: applyEdits(afterClosures, effective), changed };
}

/**
 * A continuing kid's zone school next fall, at grade `ng`, before resolving closed schools. Grade 6
 * enters a new zone. A changed cell moves the kid's zone unless its edit grandfathers a PPS kid.
 * `forced` marks a PPS kid whose own zone school is no longer its zone.
 */
export function nextZone(
  h: Household,
  ng: number,
  z: ZoningYear,
  shut: { has(school: SchoolId): boolean },
): { zone: SchoolId; forced: boolean } {
  const level = levelOf(ng);
  if (ng === ENTRY_GRADE.middle) return { zone: mappedZone(z.zones, h, level, h.zoneSchool), forced: false };
  const grandfather = z.changed[level].get(h.cell);
  const moves = grandfather === false || (grandfather === true && h.school === null);
  if (!moves && !shut.has(h.zoneSchool)) return { zone: h.zoneSchool, forced: false };
  const zone = mappedZone(z.zones, h, level, h.zoneSchool);
  return { zone, forced: moves && h.school !== null && h.school === h.zoneSchool && zone !== h.zoneSchool };
}

/** Homes in each cell: kids in and out of PPS. */
function homesByCell(households: readonly Household[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const h of households) if (!h.movedAway) out.set(h.cell, (out.get(h.cell) ?? 0) + 1);
  return out;
}

/** "The N% of zone X nearest school Y": zone X's cells nearest Y until they hold N% of its homes. */
export function sliceCells(
  state: Pick<GameState, 'households'> & { zones?: ZoneMap },
  level: ZoneLevel,
  from: SchoolId,
  nearest: SchoolId,
  percent: number,
): number[] {
  if (!SCHOOL_INFO.has(nearest)) return [];
  const { cells } = zoneGrid();
  const map = (state.zones ?? defaultZones())[level];
  const homes = homesByCell(state.households);
  const y = schoolPos(nearest);
  const ids = map
    .flatMap((s, id) => (s === from ? [id] : []))
    .map((id) => ({ id, d: dist(cells[id].center, y) }))
    .sort((a, b) => a.d - b.d || a.id - b.id);
  if (percent <= 0) return [];
  if (percent >= 100) return ids.map((c) => c.id);
  const target = (percent / 100) * ids.reduce((a, c) => a + (homes.get(c.id) ?? 0), 0);
  const out: number[] = [];
  let acc = 0;
  for (const { id } of ids) {
    out.push(id);
    if ((acc += homes.get(id) ?? 0) >= target) break;
  }
  return out;
}

/** Every edited cell connects to the receiving zone through the zone or other edited cells. */
export function isContiguous(zones: ZoneMap, edit: BoundaryEdit): boolean {
  const map = zones[edit.level];
  const pending = new Set(edit.cells.filter((c) => map[c] !== edit.to));
  const queue = [...pending].filter((c) => neighbors(c).some((n) => map[n] === edit.to));
  for (const c of queue) pending.delete(c);
  while (queue.length) {
    for (const n of neighbors(queue.pop()!))
      if (pending.delete(n)) queue.push(n);
  }
  return pending.size === 0;
}
