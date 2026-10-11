import { describe, expect, it } from 'vitest';
import { ZONES } from '../data';
import { defaultZones } from '../sim';
import { gridEdges, zoneBorders } from './borders';

const zones = defaultZones().elementary;
const r = Math.round;
const seg = (e: { a: number[]; b: number[] }) => `M${r(e.a[0])} ${r(e.a[1])}L${r(e.b[0])} ${r(e.b[1])}`;

function distToZoneEdges(p: [number, number]): number {
  let best = Infinity;
  for (const zone of ZONES.elementary)
    for (const r of zone.rings)
      for (let i = 0; i < r.length; i++) {
        const [[x1, y1], [x2, y2]] = [r[i], r[(i + 1) % r.length]];
        const [dx, dy] = [x2 - x1, y2 - y1];
        const t = Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(p[0] - x1 - t * dx, p[1] - y1 - t * dy));
      }
  return best;
}

/** An edge between zones `a` and `b`, with a's cell first. */
function between(a: string, b: (s: string) => boolean) {
  for (const e of gridEdges()) {
    if (e.cells.length !== 2) continue;
    const [p, q] = e.cells;
    if (zones[p] === a && b(zones[q])) return { ...e, cells: [p, q] };
    if (zones[q] === a && b(zones[p])) return { ...e, cells: [q, p] };
  }
  throw new Error(`no edge from ${a}`);
}

describe('zone borders', () => {
  it('gives each edge one or two distinct cells', () => {
    for (const e of gridEdges()) {
      expect(e.cells.length === 1 || e.cells[0] !== e.cells[1]).toBe(true);
    }
  });

  it("follows today's elementary zone lines", () => {
    const border = gridEdges().filter((e) => e.cells.length === 1 || zones[e.cells[0]] !== zones[e.cells[1]!]);
    const off = border.filter((e) => distToZoneEdges([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]) > 2);
    expect(border.length).toBeGreaterThan(3000);
    expect(off.length / border.length).toBeLessThan(0.03);
  });

  it('moves the line when a block changes zone', () => {
    const e = between('rosa-parks', (s) => s === 'peninsula');
    const painted = zones.map((s, c) => (c === e.cells[1] ? 'rosa-parks' : s));
    expect(zoneBorders(zones)).toContain(seg(e));
    expect(zoneBorders(painted)).not.toContain(seg(e));
  });

  it('draws only the zones asked for', () => {
    const only = zoneBorders(zones, (s) => s === 'rosa-parks');
    const e = between('rosa-parks', (s) => s !== 'rosa-parks');
    const far = between('maplewood', (s) => s !== 'maplewood' && s !== 'rosa-parks');
    expect(only).toContain(seg(e));
    expect(only).not.toContain(seg(far));
  });
});
