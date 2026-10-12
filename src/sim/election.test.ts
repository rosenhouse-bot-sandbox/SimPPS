import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY } from '.';
import { expectedYes, levyAfter, levyBallot, levyRateFor, passes, pollRange, voteYes } from './election';
import { M } from './model';
import type { Levy, Policy } from './types';

const levy: Levy = { rate: 1.99, through: 2029, failures: 0 };
const policy = (p: Partial<Policy> = {}): Policy => ({ ...DEFAULT_POLICY, ...p });

describe('levyBallot', () => {
  it('puts nothing on the ballot mid-term at the same rate', () => {
    expect(levyBallot(levy, 2027, policy())).toBeNull();
    expect(levyBallot(levy, 2027, policy({ levyElection: 'november' }))).toBeNull();
  });

  it('puts a new rate on the chosen ballot', () => {
    expect(levyBallot(levy, 2027, policy({ levyRate: 1.8 }))).toEqual({ rate: 1.8, when: 'may', renewal: false });
    expect(levyBallot(levy, 2027, policy({ levyRate: 1.8, levyElection: 'november' }))).toEqual({
      rate: 1.8,
      when: 'november',
      renewal: false,
    });
  });

  it('needs no vote to let the levy lapse', () => {
    expect(levyBallot(levy, 2030, policy({ levyRate: 0 }))).toBeNull();
  });

  it('renews in November of the last funded year, when asked', () => {
    expect(levyBallot(levy, 2029, policy())).toBeNull();
    expect(levyBallot(levy, 2029, policy({ levyElection: 'november' }))).toEqual({ rate: 1.99, when: 'november', renewal: true });
  });

  it('renews an expired levy at the rate asked', () => {
    expect(levyBallot(levy, 2030, policy())).toEqual({ rate: 1.99, when: 'may', renewal: true });
    expect(levyBallot(levy, 2030, policy({ levyRate: 1.5 }))).toEqual({ rate: 1.5, when: 'may', renewal: true });
  });
});

describe('expectedYes', () => {
  const may = { rate: 1.99, when: 'may' as const, renewal: true };

  it("starts at PPS's past result at middling trust and today's rate", () => {
    expect(expectedYes(may, 0, 35)).toBeCloseTo(M.yesBase);
  });

  it('rises with trust, falls with the rate and with past failures', () => {
    expect(expectedYes(may, 0, 45) - expectedYes(may, 0, 35)).toBeCloseTo(10 * M.yesPerTrustPoint);
    expect(expectedYes({ ...may, rate: 1.79 }, 0, 35) - expectedYes(may, 0, 35)).toBeCloseTo(2 * M.yesPerDime);
    expect(expectedYes(may, 0, 35) - expectedYes(may, 2, 35)).toBeCloseTo(2 * M.yesPerFailure);
  });

  it('can fail a raise when trust is low, and passes today\'s levy at middling trust', () => {
    expect(expectedYes({ ...may, rate: 2 }, 1, 15) + M.yesNoise).toBeLessThan(0.5);
    expect(expectedYes(may, 0, 35) - M.yesNoise).toBeGreaterThan(0.5);
  });

  it('stays a share', () => {
    expect(expectedYes(may, 30, 0)).toBe(0);
  });
});

describe('pollRange and voteYes', () => {
  it('polls within 5 points of the expected share', () => {
    expect(pollRange(0.6)).toEqual({ lo: 0.55, hi: 0.65 });
  });

  it('lands the vote within 4 points, the same for the same seed and election', () => {
    const votes = [1, 2, 3, 4, 5, 6].map((seed) => voteYes(seed, 2030, 'may', 0.6));
    for (const v of votes) expect(Math.abs(v - 0.6)).toBeLessThanOrEqual(M.yesNoise);
    expect(new Set(votes).size).toBe(votes.length);
    expect(voteYes(3, 2030, 'may', 0.5)).toBeCloseTo(votes[2] - 0.1);
    expect(voteYes(3, 2030, 'november', 0.6)).not.toBe(votes[2]);
  });
});

describe('levyRateFor', () => {
  it('keeps the levy in force through its term', () => {
    expect(levyRateFor(levy, 2029, policy(), null)).toBe(1.99);
    expect(levyRateFor({ ...levy, through: 2029 }, 2030, policy({ levyElection: 'november' }), null)).toBe(0);
  });

  it('books a May measure as passing until voters decide, and the result after', () => {
    const asked = policy({ levyRate: 1.8 });
    expect(levyRateFor(levy, 2027, asked, null)).toBe(1.8);
    expect(levyRateFor(levy, 2027, asked, true)).toBe(1.8);
    expect(levyRateFor(levy, 2027, asked, false)).toBe(1.99);
    expect(levyRateFor(levy, 2030, policy(), false)).toBe(0);
  });

  it('keeps today\'s rate until a November measure takes effect', () => {
    expect(levyRateFor(levy, 2027, policy({ levyRate: 1.8, levyElection: 'november' }), null)).toBe(1.99);
  });

  it('books nothing for a lapse', () => {
    expect(levyRateFor(levy, 2027, policy({ levyRate: 0 }), null)).toBe(0);
  });
});

describe('levyAfter', () => {
  it('runs a passed measure 5 years from the next fall it can fund', () => {
    expect(levyAfter({ ...levy, failures: 2 }, 2030, policy({ levyRate: 1.8 }), true)).toEqual({ rate: 1.8, through: 2034, failures: 0 });
    expect(levyAfter(levy, 2029, policy({ levyElection: 'november' }), true)).toEqual({ rate: 1.99, through: 2034, failures: 0 });
  });

  it('counts a failure and keeps the old levy', () => {
    expect(levyAfter(levy, 2027, policy({ levyRate: 1.8 }), false)).toEqual({ ...levy, failures: 1 });
  });

  it('ends a lapsed levy before this year', () => {
    expect(levyAfter(levy, 2027, policy({ levyRate: 0 }), null)).toEqual({ rate: 0, through: 2026, failures: 0 });
  });

  it('changes nothing without a vote', () => {
    expect(levyAfter(levy, 2027, policy(), null)).toBe(levy);
  });
});

describe('passes', () => {
  it('needs more yes votes than no votes', () => {
    expect(passes(0.5)).toBe(false);
    expect(passes(0.5001)).toBe(true);
  });
});
