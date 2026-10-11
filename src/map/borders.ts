import { CELL_METERS, cellAtPoint, zoneGrid } from '../sim';
import type { SchoolId } from '../sim/types';

/** A ring edge of the block grid, with the one or two cells it borders. */
export interface GridEdge {
  a: [number, number];
  b: [number, number];
  cells: [number] | [number, number];
}

const key = (p: [number, number]) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;

let edges: GridEdge[] | undefined;

const EPS = 1e-6;
const PROBE_M = 3;
/** The grid line a value sits on, or null. */
const gridLine = (v: number) => {
  const k = Math.round(v / CELL_METERS) * CELL_METERS;
  return Math.abs(v - k) < EPS ? k : null;
};

const snap = (v: number) => Math.round(v * 1000) / 1000;

type Span = { lo: number; hi: number; cell: number };

/** Square sides split where zones cross them, so neighbors split them differently. Overlays them. */
function sideEdges(lines: Map<string, Span[]>): GridEdge[] {
  const out: GridEdge[] = [];
  for (const [line, spans] of lines) {
    const [axis, at] = [line[0], Number(line.slice(1))];
    const cuts = [...new Set(spans.flatMap((s) => [s.lo, s.hi]))].sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const m = (cuts[i] + cuts[i + 1]) / 2;
      const owners = [...new Set(spans.filter((s) => s.lo < m && m < s.hi).map((s) => s.cell))];
      if (owners.length === 0) continue;
      const pt = (v: number): [number, number] => (axis === 'x' ? [at, v] : [v, at]);
      out.push({ a: pt(cuts[i]), b: pt(cuts[i + 1]), cells: owners.length === 1 ? [owners[0]] : [owners[0], owners[1]] });
    }
  }
  return out;
}

/** Every cell edge once; an edge two cells share lists both. */
export function gridEdges(): GridEdge[] {
  if (edges) return edges;
  const byKey = new Map<string, GridEdge>();
  const lines = new Map<string, Span[]>();
  const side = (line: string, p: number, q: number, cell: number) =>
    lines.set(line, [...(lines.get(line) ?? []), { lo: snap(Math.min(p, q)), hi: snap(Math.max(p, q)), cell }]);
  for (const c of zoneGrid().cells)
    for (const ring of c.rings)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i] as [number, number];
        const b = ring[(i + 1) % ring.length] as [number, number];
        const [ka, kb] = [key(a), key(b)];
        if (ka === kb) continue;
        const [gx, gy] = [gridLine(a[0]), gridLine(a[1])];
        if (gx !== null && gx === gridLine(b[0])) side(`x${gx}`, a[1], b[1], c.id);
        else if (gy !== null && gy === gridLine(b[1])) side(`y${gy}`, a[0], b[0], c.id);
        else {
          const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
          const e = byKey.get(k);
          if (!e) byKey.set(k, { a, b, cells: [c.id] });
          else if (e.cells.length === 1 && e.cells[0] !== c.id) e.cells = [e.cells[0], c.id];
        }
      }
  return (edges = [...byKey.values(), ...sideEdges(lines)].map(pairAcross));
}

/** Probes across an edge with one cell, since neighboring zones don't always share vertices. */
function pairAcross(e: GridEdge): GridEdge {
  if (e.cells.length === 2) return e;
  const { a, b } = e;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len === 0) return e;
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const [nx, ny] = [(a[1] - b[1]) / len, (b[0] - a[0]) / len];
  for (const side of [1, -1]) {
    const c = cellAtPoint([mx + side * PROBE_M * nx, my + side * PROBE_M * ny]);
    if (c >= 0 && c !== e.cells[0]) return { ...e, cells: [e.cells[0], c] };
  }
  return e;
}

/** Edges between zones, and around the district, as an SVG path. */
export function zoneBorders(zones: readonly SchoolId[], only?: (school: SchoolId) => boolean): string {
  let d = '';
  for (const { a, b, cells } of gridEdges()) {
    const [p, q] = cells;
    if (q !== undefined && zones[p] === zones[q]) continue;
    if (only && !only(zones[p]) && (q === undefined || !only(zones[q]))) continue;
    d += `M${Math.round(a[0])} ${Math.round(a[1])}L${Math.round(b[0])} ${Math.round(b[1])}`;
  }
  return d;
}
