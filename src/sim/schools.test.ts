import { describe, expect, it } from 'vitest';
import { setModelParams } from './model';
import { computeDials } from './schools';
import type { Budget, SchoolState } from './types';

const school = (id: string, byGrade: number[], blendedHomerooms = 0): SchoolState => ({
  id,
  open: true,
  enrollment: byGrade.reduce((a, n) => a + n, 0),
  byGrade,
  capacity: 1_000,
  stateRevenue: 0,
  homerooms: 0,
  k5Homerooms: 0,
  blendedHomerooms,
});

const classrooms = (...schools: SchoolState[]) =>
  computeDials({ households: [], schools: Object.fromEntries(schools.map((s) => [s.id, s])), budget: { gap: 0, reservePct: 0 } as Budget }, 0, 0).classrooms;

describe('the Classrooms dial', () => {
  it('counts K-5 kids at two-section schools without blending, and grade 6-8 kids in large middle grades', () => {
    expect(classrooms(school('rosa-parks', [48, 48, 48, 48, 48, 48, 0, 0, 0]))).toBe(288);
    expect(classrooms(school('rosa-parks', [48, 48, 48, 48, 48, 48, 0, 0, 0], 1))).toBe(0);
    expect(classrooms(school('rosa-parks', [40, 40, 40, 40, 40, 40, 0, 0, 0]))).toBe(0);
    expect(classrooms(school('glencoe', [0, 0, 0, 0, 0, 0, 130, 130, 130]))).toBe(390);
    expect(classrooms(school('glencoe', [0, 0, 0, 0, 0, 0, 120, 120, 120]))).toBe(0);
  });

  it('uses the model thresholds', () => {
    setModelParams({ classroomsK5: 240, classroomsMiddle: 360 });
    expect(classrooms(school('rosa-parks', [40, 40, 40, 40, 40, 40, 120, 120, 120]))).toBe(600);
  });
});
