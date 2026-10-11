import { describe, expect, it } from 'vitest';
import { NO_DATA_COLOR, SEAT_BANDS, seatColor, utilization } from './colors';

describe('seat utilization colors', () => {
  it('divides enrollment by capacity, or gives null without capacity', () => {
    expect(utilization({ enrollment: 160, capacity: 594 })).toBeCloseTo(0.269, 3);
    expect(utilization({ enrollment: 160, capacity: 0 })).toBeNull();
  });

  it('bands at 60, 85, 100 and 110 percent', () => {
    const [under, low, right, full, crowded] = SEAT_BANDS.map((b) => b.color);
    expect(seatColor(0.59)).toBe(under);
    expect(seatColor(0.6)).toBe(low);
    expect(seatColor(0.849)).toBe(low);
    expect(seatColor(0.85)).toBe(right);
    expect(seatColor(1.0)).toBe(full);
    expect(seatColor(1.1)).toBe(crowded);
    expect(seatColor(null)).toBe(NO_DATA_COLOR);
  });

  it('labels every band with a distinct color', () => {
    expect(SEAT_BANDS.map((b) => b.label)).toEqual(['Under 60%', '60–85%', '85–100%', '100–110%', 'Over 110%']);
    expect(new Set([...SEAT_BANDS.map((b) => b.color), NO_DATA_COLOR]).size).toBe(6);
  });
});
