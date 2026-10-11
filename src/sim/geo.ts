import type { Point, Zone } from '../data';

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

/** Uniform rejection sampling inside the zone. Coordinates round to whole meters. */
export function samplePoint(zone: Zone, rand: () => number): Point {
  const b = boxOf(zone);
  for (;;) {
    const p: Point = [
      Math.round(b.minX + rand() * (b.maxX - b.minX)),
      Math.round(b.minY + rand() * (b.maxY - b.minY)),
    ];
    if (inZone(p, zone)) return p;
  }
}

export class ZoneIndex {
  constructor(readonly zones: Zone[]) {}

  /** Index of the first zone holding the point, or -1. */
  find(p: Point): number {
    return this.zones.findIndex((z) => inZone(p, z));
  }
}
