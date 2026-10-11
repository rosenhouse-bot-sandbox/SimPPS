import { ZONES, type Point, type Ring } from '../data';
import { ZoneIndex } from './geo';

/** model.zoneGrid: the side of a grid square. */
export const CELL_METERS = 250;

/** A grid square clipped to one elementary zone. */
export interface ZoneCell {
  id: number;
  /** The square spans x from ix * CELL_METERS and y from iy * CELL_METERS. */
  ix: number;
  iy: number;
  /** Index into ZONES.elementary. */
  elemZone: number;
  /** Square meters. */
  area: number;
  /** Area-weighted center, in whole meters. */
  center: Point;
  rings: Ring[];
}

export interface ZoneGrid {
  cells: ZoneCell[];
  /** Cell ids by elementary zone. */
  byZone: number[][];
}

const OFFSET = 512;
const squareKey = (ix: number, iy: number) => (ix + OFFSET) * 1024 + iy + OFFSET;
const cellKey = (ix: number, iy: number, z: number) => squareKey(ix, iy) * 64 + z;

type Side = [(p: Point) => boolean, (a: Point, b: Point) => Point];

const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const xSides = (x0: number, x1: number): Side[] => [
  [(p) => p[0] >= x0, (a, b) => lerp(a, b, (x0 - a[0]) / (b[0] - a[0]))],
  [(p) => p[0] <= x1, (a, b) => lerp(a, b, (x1 - a[0]) / (b[0] - a[0]))],
];
const ySides = (y0: number, y1: number): Side[] => [
  [(p) => p[1] >= y0, (a, b) => lerp(a, b, (y0 - a[1]) / (b[1] - a[1]))],
  [(p) => p[1] <= y1, (a, b) => lerp(a, b, (y1 - a[1]) / (b[1] - a[1]))],
];

/** Sutherland-Hodgman against half-planes. */
function clip(ring: Ring, sides: Side[]): Ring {
  let out = ring;
  for (const [inside, cross] of sides) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cross(prev, cur));
    }
  }
  return out;
}

function signedArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1];
  return a / 2;
}

function centroid(r: Ring): Point {
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    cx += (r[j][0] + r[i][0]) * f;
    cy += (r[j][1] + r[i][1]) * f;
  }
  const a = 6 * signedArea(r);
  return [cx / a, cy / a];
}

function build(): ZoneGrid & { index: Map<number, number> } {
  const cells: ZoneCell[] = [];
  const index = new Map<number, number>();
  const S = CELL_METERS;
  ZONES.elementary.forEach((zone, z) => {
    const ys = zone.rings.flat().map((p) => p[1]);
    for (let iy = Math.floor(Math.min(...ys) / S); iy <= Math.floor(Math.max(...ys) / S); iy++) {
      const strip = zone.rings.map((r) => clip(r, ySides(iy * S, (iy + 1) * S))).filter((r) => r.length >= 3);
      if (strip.length === 0) continue;
      const sx = strip.flat().map((p) => p[0]);
      for (let ix = Math.floor(Math.min(...sx) / S); ix <= Math.floor(Math.max(...sx) / S); ix++) {
        const rings = strip.map((r) => clip(r, xSides(ix * S, (ix + 1) * S))).filter((r) => r.length >= 3);
        const areas = rings.map((r) => Math.abs(signedArea(r)));
        const area = areas.reduce((a, b) => a + b, 0);
        if (area < 1) continue;
        let cx = 0;
        let cy = 0;
        rings.forEach((r, i) => {
          if (areas[i] === 0) return;
          const [x, y] = centroid(r);
          cx += (x * areas[i]) / area;
          cy += (y * areas[i]) / area;
        });
        index.set(cellKey(ix, iy, z), cells.length);
        cells.push({ id: cells.length, ix, iy, elemZone: z, area, center: [Math.round(cx), Math.round(cy)], rings });
      }
    }
  });
  const byZone = ZONES.elementary.map(() => [] as number[]);
  for (const c of cells) byZone[c.elemZone].push(c.id);
  return { cells, byZone, index };
}

let grid: ReturnType<typeof build> | undefined;

/** Grid squares clipped to the real elementary zones. Built on first use. */
export function zoneGrid(): ZoneGrid {
  return (grid ??= build());
}

/** The cell of elementary zone `elemZone` holding `pos`, or that zone's nearest cell. */
export function cellAt(pos: Point, elemZone: number): number {
  zoneGrid();
  const id = grid!.index.get(cellKey(Math.floor(pos[0] / CELL_METERS), Math.floor(pos[1] / CELL_METERS), elemZone));
  if (id !== undefined) return id;
  let best = -1;
  let bestD = Infinity;
  for (const c of grid!.byZone[elemZone]) {
    const [x, y] = grid!.cells[c].center;
    const d = (x - pos[0]) ** 2 + (y - pos[1]) ** 2;
    if (d < bestD) [best, bestD] = [c, d];
  }
  return best;
}

const ELEM = new ZoneIndex(ZONES.elementary);

/** The cell under a point, or -1 outside every elementary zone. */
export function cellAtPoint(pos: Point): number {
  const z = ELEM.find(pos);
  return z < 0 ? -1 : cellAt(pos, z);
}

let squares: Map<number, number[]> | undefined;

/** Cells in the same grid square or a square beside it. */
export function neighbors(id: number): number[] {
  const { cells } = zoneGrid();
  if (!squares) {
    squares = new Map();
    for (const c of cells) {
      const k = squareKey(c.ix, c.iy);
      squares.set(k, [...(squares.get(k) ?? []), c.id]);
    }
  }
  const { ix, iy } = cells[id];
  const out: number[] = [];
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]])
    for (const n of squares.get(squareKey(ix + dx, iy + dy)) ?? []) if (n !== id) out.push(n);
  return out;
}
