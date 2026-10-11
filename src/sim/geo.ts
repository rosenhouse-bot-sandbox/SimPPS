import type { Point, Zone } from '../data';
import { onRiver, RIVERS } from '../map/rivers';

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const boxes = new WeakMap<Zone, Box>();

function boxOf(zone: Zone): Box {
  let box = boxes.get(zone);
  if (!box) {
    box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const ring of zone.rings)
      for (const [x, y] of ring) {
        box.minX = Math.min(box.minX, x);
        box.minY = Math.min(box.minY, y);
        box.maxX = Math.max(box.maxX, x);
        box.maxY = Math.max(box.maxY, y);
      }
    boxes.set(zone, box);
  }
  return box;
}

/** Even-odd rule over all rings, so inner rings are holes and separate rings are parts. */
export function inZone([px, py]: Point, zone: Zone): boolean {
  const b = boxOf(zone);
  if (px < b.minX || px > b.maxX || py < b.minY || py > b.maxY) return false;
  let inside = false;
  for (const ring of zone.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Uniform rejection sampling inside the zone and off the rivers. Coordinates round to whole meters. */
export function samplePoint(zone: Zone, rand: () => number): Point {
  const b = boxOf(zone);
  for (;;) {
    const p: Point = [
      Math.round(b.minX + rand() * (b.maxX - b.minX)),
      Math.round(b.minY + rand() * (b.maxY - b.minY)),
    ];
    if (inZone(p, zone) && !onRiver(p)) return p;
  }
}

export class ZoneIndex {
  constructor(readonly zones: Zone[]) {}

  /** Index of the first zone holding the point, or -1. */
  find(p: Point): number {
    return this.zones.findIndex((z) => inZone(p, z));
  }
}

const WILLAMETTE = RIVERS.find((r) => r.name === 'Willamette')!.points;

/** The Willamette's x at a given y, held at its ends. Its points run north to south. */
function willametteX(y: number): number {
  const i = WILLAMETTE.findIndex(([, py]) => py >= y);
  if (i <= 0) return WILLAMETTE[i < 0 ? WILLAMETTE.length - 1 : 0][0];
  const [ax, ay] = WILLAMETTE[i - 1];
  const [bx, by] = WILLAMETTE[i];
  return ax + ((bx - ax) * (y - ay)) / (by - ay);
}

/** True when the Willamette runs between two points. */
export function acrossWillamette(a: Point, b: Point): boolean {
  return a[0] < willametteX(a[1]) !== b[0] < willametteX(b[1]);
}
