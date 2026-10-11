import { clamp } from '../clamp';
import { M } from './model';
import { draw } from './rng';
import type { Ballot, ElectionMonth, Levy, Policy, Range } from './types';

/** The measure, if any, that `policy` puts before voters in the year planned for fall `year`. A lapse needs no vote. */
export function levyBallot(levy: Levy, year: number, policy: Pick<Policy, 'levyRate' | 'levyElection'>): Ballot | null {
  const { levyRate: rate, levyElection: when } = policy;
  if (rate === 0) return null;
  if (levy.through < year) return { rate, when, renewal: true };
  if (rate !== levy.rate) return { rate, when, renewal: false };
  if (levy.through === year && when === 'november') return { rate, when, renewal: true };
  return null;
}

/** Trust midway through its starting range moves no votes. */
const TRUST_MID = (M.trustStart.lo + M.trustStart.hi) / 2;

/** model.election: the yes share before the election's luck. */
export function expectedYes(ballot: Ballot, failures: number, trust: number): number {
  return clamp(
    M.yesBase +
      M.yesPerTrustPoint * (trust - TRUST_MID) -
      (M.yesPerDime * (ballot.rate - M.levyRate)) / 0.1 -
      M.yesPerFailure * failures,
    0,
    1,
  );
}

export function pollRange(expected: number): Range {
  const r = (x: number) => Math.round(clamp(x, 0, 1) * 1000) / 1000;
  return { lo: r(expected - M.pollSpread), hi: r(expected + M.pollSpread) };
}

const ELECTION_DRAW = 40;

/** The vote: the player and the ghost share the election's luck. */
export function voteYes(seedHash: number, year: number, when: ElectionMonth, expected: number): number {
  const u = draw(seedHash, year, when === 'may' ? 0 : 1, ELECTION_DRAW);
  return clamp(expected + (2 * u - 1) * M.yesNoise, 0, 1);
}

/**
 * The levy rate funding the school year from fall `year`. `mayPassed` is null before the May vote,
 * when a May measure is booked as passing.
 */
export function levyRateFor(levy: Levy, year: number, policy: Policy, mayPassed: boolean | null): number {
  if (policy.levyRate === 0) return 0;
  const ballot = levyBallot(levy, year, policy);
  if (ballot?.when === 'may' && mayPassed !== false) return ballot.rate;
  return levy.through >= year ? levy.rate : 0;
}

/** The levy after the year planned for fall `year`. `passed` is null when nothing went to voters. */
export function levyAfter(levy: Levy, year: number, policy: Policy, passed: boolean | null): Levy {
  if (policy.levyRate === 0) return { rate: 0, through: Math.min(levy.through, year - 1), failures: levy.failures };
  const ballot = levyBallot(levy, year, policy);
  if (!ballot || passed === null) return levy;
  if (!passed) return { ...levy, failures: levy.failures + 1 };
  const from = ballot.when === 'may' ? year : year + 1;
  return { rate: ballot.rate, through: from + M.levyYears - 1, failures: 0 };
}
