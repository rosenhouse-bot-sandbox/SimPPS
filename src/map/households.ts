import type { Point } from '../data';
import type { Household, HouseholdStatus, SchoolId } from '../sim/types';
import { WINDOW_COLORS } from './colors';
import { toScreen, type View } from './projection';
import type { ZoomLevel } from './zoom';

export const TRAIL_PX = 14;
const BIN_PX = 12;

export type HouseholdCtx = Pick<
  CanvasRenderingContext2D,
  'fillStyle' | 'strokeStyle' | 'lineWidth' | 'clearRect' | 'fillRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'stroke'
>;

export interface DrawOptions {
  width: number;
  height: number;
  level: ZoomLevel;
  emphasize: boolean;
  flickerOn: boolean;
  schoolPos: (id: SchoolId) => Point | undefined;
}

/** Dark windows first so lit ones sit on top. */
const DRAW_ORDER: HouseholdStatus[] = ['left', 'stayed', 'moved', 'returned'];

export interface Bin {
  x: number;
  y: number;
  count: number;
  status: HouseholdStatus;
}

export function binHouseholds(hs: Household[], view: View, cellPx: number, width: number, height: number): Bin[] {
  const cells = new Map<string, { col: number; row: number; counts: Record<HouseholdStatus, number> }>();
  for (const h of hs) {
    const [x, y] = toScreen(view, h.pos);
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const col = Math.floor(x / cellPx);
    const row = Math.floor(y / cellPx);
    const key = `${col},${row}`;
    let cell = cells.get(key);
    if (!cell) cells.set(key, (cell = { col, row, counts: { left: 0, stayed: 0, moved: 0, returned: 0 } }));
    cell.counts[h.status]++;
  }
  return [...cells.values()].map(({ col, row, counts }) => ({
    x: (col + 0.5) * cellPx,
    y: (row + 0.5) * cellPx,
    count: DRAW_ORDER.reduce((sum, s) => sum + counts[s], 0),
    status: DRAW_ORDER.reduce((best, s) => (counts[s] > counts[best] ? s : best)),
  }));
}

export function drawHouseholds(ctx: HouseholdCtx, hs: Household[], view: View, o: DrawOptions): void {
  ctx.clearRect(0, 0, o.width, o.height);
  if (o.level === 'street') drawWindows(ctx, hs, view, o);
  else drawBins(ctx, binHouseholds(hs, view, BIN_PX, o.width, o.height), o.emphasize);
}

function colorOf(status: HouseholdStatus, flickerOn: boolean): string {
  return status === 'returned' && !flickerOn ? WINDOW_COLORS.left : WINDOW_COLORS[status];
}

function drawWindows(ctx: HouseholdCtx, hs: Household[], view: View, o: DrawOptions): void {
  const size = o.emphasize ? 4 : 3;
  for (const status of DRAW_ORDER) {
    ctx.fillStyle = colorOf(status, o.flickerOn);
    ctx.strokeStyle = WINDOW_COLORS.moved;
    ctx.lineWidth = 1;
    for (const h of hs) {
      if (h.status !== status) continue;
      const [x, y] = toScreen(view, h.pos);
      if (x < -TRAIL_PX || y < -TRAIL_PX || x > o.width + TRAIL_PX || y > o.height + TRAIL_PX) continue;
      if (status === 'moved' && h.school) drawTrail(ctx, view, [x, y], o.schoolPos(h.school));
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    }
  }
}

function drawTrail(ctx: HouseholdCtx, view: View, from: Point, target: Point | undefined): void {
  if (!target) return;
  const [tx, ty] = toScreen(view, target);
  const d = Math.hypot(tx - from[0], ty - from[1]);
  if (d < 1) return;
  const k = Math.min(TRAIL_PX, d) / d;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(from[0] + (tx - from[0]) * k, from[1] + (ty - from[1]) * k);
  ctx.stroke();
}

function drawBins(ctx: HouseholdCtx, bins: Bin[], emphasize: boolean): void {
  const max = BIN_PX - (emphasize ? 1 : 3);
  for (const status of DRAW_ORDER) {
    ctx.fillStyle = WINDOW_COLORS[status];
    for (const b of bins) {
      if (b.status !== status) continue;
      const s = Math.min(max, 2 + Math.sqrt(b.count) * 1.5);
      ctx.fillRect(b.x - s / 2, b.y - s / 2, s, s);
    }
  }
}
