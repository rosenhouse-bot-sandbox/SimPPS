import { SCHOOLS, ZONES } from '../data';
import { schoolPos } from '../sim/closures';
import type { BoundaryEdit, SchoolId, ZoneLevel, ZoneMap } from '../sim/types';
import { nameOf } from './closeSend';

/** A boundary edit being painted. Each stroke is one undo step. */
export interface ZoneDraft {
  level: ZoneLevel;
  to: SchoolId;
  strokes: number[][];
  grandfather: boolean;
  /** The menu path: the `percent` of zone `from` nearest the target, added as one more stroke. */
  slice?: { from: SchoolId; percent: number };
}

export function startZoneDraft(level: ZoneLevel, to: SchoolId): ZoneDraft {
  return { level, to, strokes: [], grandfather: true };
}

export function addStroke(d: ZoneDraft, cells: number[]): ZoneDraft {
  return cells.length ? { ...d, strokes: [...d.strokes, cells] } : d;
}

export function undoStroke(d: ZoneDraft): ZoneDraft {
  return { ...d, strokes: d.strokes.slice(0, -1) };
}

/** Painted cells not already in the target's zone, in paint order. */
export function draftCells(d: ZoneDraft, zones: ZoneMap): number[] {
  const map = zones[d.level];
  return [...new Set(d.strokes.flat())].filter((c) => map[c] !== d.to);
}

export function toEdit(d: ZoneDraft, zones: ZoneMap): BoundaryEdit {
  return { level: d.level, to: d.to, cells: draftCells(d, zones), grandfather: d.grandfather };
}

/** Open schools with a zone at the level, A–Z. */
export function targets(level: ZoneLevel, shut: ReadonlySet<SchoolId>): { id: SchoolId; name: string }[] {
  return ZONES[level]
    .filter((z) => !shut.has(z.school) && SCHOOLS.some((s) => s.id === z.school))
    .map((z) => ({ id: z.school, name: nameOf(z.school) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Zones a slice can come from: those holding cells at the level, nearest the target first. */
export function sliceSources(level: ZoneLevel, zones: ZoneMap, to: SchoolId): SchoolId[] {
  const at = schoolPos(to);
  const d = (s: SchoolId) => Math.hypot(schoolPos(s)[0] - at[0], schoolPos(s)[1] - at[1]);
  return [...new Set(zones[level])].filter((s) => s !== to).sort((a, b) => d(a) - d(b));
}
