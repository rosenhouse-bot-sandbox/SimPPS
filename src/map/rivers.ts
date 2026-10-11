import type { Point } from '../data';

export interface River {
  name: string;
  /** Drawn width in meters. */
  width: number;
  points: Point[];
}

/** Traced along the zone lines that follow the river banks; stylized, not survey-grade. */
export const RIVERS: River[] = [
  {
    name: 'Columbia',
    width: 1100,
    points: [
      [-14000, -21500],
      [-11000, -18000],
      [-8200, -14700],
      [-6000, -14300],
      [-4000, -13300],
      [-3000, -12250],
      [-2000, -11600],
      [-1000, -11300],
      [0, -10650],
      [1000, -10450],
      [3500, -9700],
      [8600, -8800],
      [16400, -7200],
    ],
  },
  {
    name: 'Willamette',
    width: 380,
    points: [
      [-8200, -14700],
      [-9500, -12800],
      [-10300, -11300],
      [-10200, -11000],
      [-9800, -10000],
      [-9350, -9000],
      [-8800, -8000],
      [-7900, -7000],
      [-6400, -6000],
      [-5450, -5000],
      [-4100, -4000],
      [-2650, -3000],
      [-1800, -2000],
      [-850, -1000],
      [-620, -500],
      [-650, 0],
      [-790, 800],
      [-600, 1500],
      [-430, 2000],
      [-610, 3000],
      [-740, 4000],
      [-470, 5000],
      [-400, 6200],
      [-250, 7000],
      [-50, 8500],
      [150, 10500],
    ],
  },
  {
    name: 'Multnomah Channel',
    width: 200,
    points: [
      [-10300, -11300],
      [-12500, -14500],
      [-15500, -19000],
    ],
  },
];

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** True within a river's drawn width. */
export function onRiver(p: Point): boolean {
  return RIVERS.some((r) => r.points.some((a, i) => i > 0 && distanceToSegment(p, r.points[i - 1], a) <= r.width / 2));
}
