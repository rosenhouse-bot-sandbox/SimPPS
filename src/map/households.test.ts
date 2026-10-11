import { describe, expect, it } from 'vitest';
import type { Household, HouseholdStatus } from '../sim/types';
import { WINDOW_COLORS } from './colors';
import { TRAIL_PX, binHouseholds, drawHouseholds, type HouseholdCtx } from './households';

function hh(id: number, pos: [number, number], status: HouseholdStatus, school: string | null = 'a'): Household {
  const h: Household = { id, pos, kids: [1], zoneSchool: 'a', school, exitCapacity: 0, loyalty: 0, voice: 0, status };
  return status === 'left' ? { ...h, leftThisYear: true } : h;
}

function outsidePps(id: number, pos: [number, number]): Household {
  return { ...hh(id, pos, 'left', null), leftThisYear: undefined };
}

function recorder() {
  const rects: { x: number; y: number; color: string }[] = [];
  const outlines: { x: number; y: number }[] = [];
  const lines: { from: number[]; to: number[] }[] = [];
  let from: number[] = [];
  const ctx: HouseholdCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect() {},
    fillRect(x, y, w, h) {
      rects.push({ x: x + w / 2, y: y + h / 2, color: ctx.fillStyle as string });
    },
    strokeRect(x, y, w, h) {
      outlines.push({ x: x + w / 2, y: y + h / 2 });
    },
    beginPath() {},
    moveTo(x, y) {
      from = [x, y];
    },
    lineTo(x, y) {
      lines.push({ from, to: [x, y] });
    },
    stroke() {},
  };
  return { ctx, rects, lines, outlines };
}

const view = { scale: 1, tx: 0, ty: 0 };
const base = { width: 100, height: 100, emphasize: false, flickerOn: true, schoolPos: () => [90, 10] as [number, number] };

describe('drawHouseholds at street level', () => {
  const street = { ...base, level: 'street' as const };

  it('draws one window per on-screen household in its status color', () => {
    const { ctx, rects } = recorder();
    drawHouseholds(ctx, [hh(1, [10, 10], 'stayed'), hh(2, [20, 20], 'left', null), hh(3, [500, 10], 'stayed')], view, street);
    expect(rects).toEqual([
      { x: 20, y: 20, color: WINDOW_COLORS.left },
      { x: 10, y: 10, color: WINDOW_COLORS.stayed },
    ]);
  });

  it('leaves out residents who were outside PPS before this year', () => {
    const { ctx, rects } = recorder();
    drawHouseholds(ctx, [outsidePps(1, [10, 10])], view, street);
    expect(rects).toEqual([]);
  });

  it('draws a short trail from a moved window toward its new school', () => {
    const { ctx, lines } = recorder();
    drawHouseholds(ctx, [hh(1, [10, 10], 'moved')], view, street);
    expect(lines).toEqual([{ from: [10, 10], to: [10 + TRAIL_PX, 10] }]);
  });

  it('flickers a returned window between bright and dark', () => {
    const on = recorder();
    const off = recorder();
    drawHouseholds(on.ctx, [hh(1, [10, 10], 'returned')], view, street);
    drawHouseholds(off.ctx, [hh(1, [10, 10], 'returned')], view, { ...street, flickerOn: false });
    expect(on.rects[0].color).toBe(WINDOW_COLORS.returned);
    expect(off.rects[0].color).toBe(WINDOW_COLORS.left);
  });
});

describe('below street level', () => {
  const homes = [hh(1, [1, 1], 'stayed'), hh(2, [5, 5], 'left', null), hh(3, [6, 2], 'left', null), hh(4, [50, 50], 'stayed')];

  it('bins households into cells colored by the most common status', () => {
    const bins = binHouseholds(homes, view, 12, 100, 100);
    expect(bins.map((b) => [b.count, b.status])).toEqual([
      [3, 'left'],
      [1, 'stayed'],
    ]);
  });

  it('does not bin residents who were outside PPS before this year', () => {
    expect(binHouseholds([outsidePps(1, [1, 1]), hh(2, [2, 2], 'stayed')], view, 12, 100, 100)).toEqual([
      { x: 6, y: 6, count: 1, status: 'stayed' },
    ]);
  });

  it('draws one glyph per bin', () => {
    const { ctx, rects } = recorder();
    drawHouseholds(ctx, homes, view, { ...base, level: 'district' });
    expect(rects.map((r) => r.color)).toEqual([WINDOW_COLORS.left, WINDOW_COLORS.stayed]);
  });
});

describe('closure flows', () => {
  const mover = { ...hh(1, [10, 10], 'moved'), movedFrom: 'b' };
  const leaver = { ...hh(2, [30, 30], 'left', null), movedFrom: 'b' };
  const other = hh(3, [50, 50], 'moved');

  it("grow a trail from each closed school's mover toward its new school", () => {
    const { ctx, lines } = recorder();
    drawHouseholds(ctx, [mover, leaver, other], view, { ...base, level: 'district', flows: 0.5 });
    expect(lines).toEqual([{ from: [10, 10], to: [50, 10] }]);
  });

  it("darken each leaver's window with a ring", () => {
    const { ctx, rects, outlines } = recorder();
    drawHouseholds(ctx, [mover, leaver], view, { ...base, level: 'neighborhood', flows: 1 });
    expect(rects.slice(-2)).toEqual([
      { x: 10, y: 10, color: WINDOW_COLORS.moved },
      { x: 30, y: 30, color: WINDOW_COLORS.left },
    ]);
    expect(outlines).toEqual([{ x: 30, y: 30 }]);
  });

  it('are left out unless asked for', () => {
    const { ctx, lines } = recorder();
    drawHouseholds(ctx, [mover], view, { ...base, level: 'district' });
    expect(lines).toEqual([]);
  });
});
