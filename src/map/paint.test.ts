import { describe, expect, it } from 'vitest';
import { cellAtPoint, CELL_METERS, zoneGrid } from '../sim';
import { strokeCells } from './paint';

describe('strokeCells', () => {
  it('paints the cells under a drag, leaving no gaps between samples', () => {
    const { cells } = zoneGrid();
    const a = cells[cellAtPoint([0, 0])].center;
    const b: [number, number] = [a[0] + 8 * CELL_METERS, a[1]];
    const out = strokeCells(a, b);
    expect(out[0]).toBe(cellAtPoint(a));
    expect(out).toContain(cellAtPoint(b));
    expect(new Set(out).size).toBe(out.length);
    expect(out.length).toBeGreaterThanOrEqual(9);
  });

  it('paints one cell for a tap and none off the map', () => {
    const a = zoneGrid().cells[100].center;
    expect(strokeCells(a, a)).toEqual([100]);
    expect(strokeCells([1e7, 1e7], [1e7, 1e7])).toEqual([]);
  });
});
