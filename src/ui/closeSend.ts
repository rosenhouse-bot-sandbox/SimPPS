import { SCHOOLS } from '../data';
import { shortName } from '../map/geometry';
import { miles, schoolPos } from '../sim/closures';
import { SCHOOL_INFO } from '../sim/population';
import type { BuildingFate, Closure, SchoolId, SchoolState } from '../sim/types';

export interface Candidate {
  id: SchoolId;
  name: string;
  miles: number;
  kids: number;
  capacity: number;
}

export const NEARBY = 5;

export function nameOf(id: SchoolId): string {
  return shortName(SCHOOLS.find((s) => s.id === id)?.name ?? id);
}

export function canClose(s: SchoolState | undefined): boolean {
  return !!s && s.open && s.enrollment > 0;
}

/** Open schools that serve some of the closing school's grades, nearest first. */
export function receiverCandidates(
  schools: Record<SchoolId, SchoolState>,
  closing: SchoolId,
  plan: Closure[],
): Candidate[] {
  const from = SCHOOL_INFO.get(closing)!;
  const busy = new Set(plan.map((c) => c.school));
  const home = schoolPos(closing);
  return [...SCHOOL_INFO.values()]
    .filter((i) => {
      const s = schools[i.data.id];
      return s?.open && i.data.id !== closing && !busy.has(i.data.id) && i.lo <= from.hi && i.hi >= from.lo;
    })
    .map((i) => {
      const s = schools[i.data.id];
      return { id: s.id, name: nameOf(s.id), miles: miles(home, schoolPos(s.id)), kids: s.enrollment, capacity: s.capacity };
    })
    .sort((a, b) => a.miles - b.miles);
}

export interface CloseDraft {
  school: SchoolId;
  /** 1 receivers, 2 shares, 3 building, 4 call it. */
  step: 1 | 2 | 3 | 4;
  receivers: SchoolId[];
  /** The first receiver's percent; the second takes the rest. */
  firstShare: number;
  building: BuildingFate;
}

export function startDraft(school: SchoolId, existing?: Closure): CloseDraft {
  if (!existing) return { school, step: 1, receivers: [], firstShare: 100, building: 'mothball' };
  return {
    school,
    step: 1,
    receivers: existing.receivers.map((r) => r.school),
    firstShare: Math.round(existing.receivers[0].share * 100),
    building: existing.building,
  };
}

/** A third pick replaces the second. Shares reset to 100 or 70/30. */
export function toggleReceiver(d: CloseDraft, id: SchoolId): CloseDraft {
  const receivers = d.receivers.includes(id) ? d.receivers.filter((r) => r !== id) : [d.receivers[0], id].filter(Boolean);
  return { ...d, receivers, firstShare: receivers.length === 2 ? 70 : 100 };
}

export function toClosure(d: CloseDraft, guess?: number): Closure {
  const shares = d.receivers.length === 2 ? [d.firstShare / 100, 1 - d.firstShare / 100] : [1];
  return {
    school: d.school,
    receivers: d.receivers.map((school, i) => ({ school, share: Math.round(shares[i] * 100) / 100 })),
    building: d.building,
    ...(guess === undefined ? {} : { guess }),
  };
}
