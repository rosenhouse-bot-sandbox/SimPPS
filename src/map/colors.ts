import type { HouseholdStatus, SchoolState } from '../sim/types';

/** A blue–orange diverging scale, safe for common color blindness. */
export const SEAT_BANDS = [
  { below: 0.6, color: '#2f6fb3', label: 'Under 60%' },
  { below: 0.85, color: '#92c5de', label: '60–85%' },
  { below: 1.0, color: '#f2efe6', label: '85–100%' },
  { below: 1.1, color: '#fdb863', label: '100–110%' },
  { below: Infinity, color: '#e66101', label: 'Over 110%' },
];

export const NO_DATA_COLOR = '#8a8a8a';

export function utilization(s: Pick<SchoolState, 'enrollment' | 'capacity'>): number | null {
  return s.capacity > 0 ? s.enrollment / s.capacity : null;
}

export function seatColor(u: number | null): string {
  if (u === null) return NO_DATA_COLOR;
  return SEAT_BANDS.find((b) => u < b.below)!.color;
}

/** Brightness carries the meaning, so the windows read without hue. */
export const WINDOW_COLORS: Record<HouseholdStatus, string> = {
  stayed: '#ffd75e',
  moved: '#9fd8ff',
  left: '#3a3a40',
  returned: '#ffffff',
};

export const WINDOW_LABELS: Record<HouseholdStatus, string> = {
  stayed: 'Stayed',
  moved: 'Moved',
  left: 'Left PPS',
  returned: 'Came back',
};
