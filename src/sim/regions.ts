import { ZONES, type Point } from '../data';
import { ZoneIndex } from './geo';
import { zoneGrid } from './grid';

const HIGH = new ZoneIndex(ZONES.high);
/** Neutral names for high school zones, so headlines never name a school. */
const REGION: Record<string, string> = {
  Cleveland: 'Inner Southeast',
  Franklin: 'Outer Southeast',
  Grant: 'Northeast',
  'Ida B. Wells': 'Southwest',
  'Jefferson / Grant': 'Northeast',
  'Jefferson / McDaniel': 'Outer Northeast',
  'Jefferson / Roosevelt': 'North',
  Lincoln: 'Northwest',
  McDaniel: 'Outer Northeast',
  Roosevelt: 'North',
};

export const REGIONS = [...new Set(Object.values(REGION))].sort();

export function regionOf(pos: Point): string | null {
  const z = HIGH.find(pos);
  return z >= 0 ? REGION[ZONES.high[z].name] : null;
}

let byCell: (string | null)[] | null = null;

/** A zone block's region, by its center. Cheaper than regionOf for every home. */
export function regionOfCell(cell: number): string | null {
  byCell ??= zoneGrid().cells.map((c) => regionOf(c.center));
  return byCell[cell];
}
