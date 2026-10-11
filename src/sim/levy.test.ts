import { describe, expect, it } from 'vitest';
import { ballotPreview, DEFAULT_POLICY, endYear, levyRevenue, newGame, previewBudget, SCENARIOS, type GameState, type Policy } from '.';
import { M } from './model';
import { stepYear } from './step';

const start = newGame({ seed: 'levy' });
const play = (s: GameState, years: number, policy: Policy = DEFAULT_POLICY) => {
  for (let i = 0; i < years; i++) s = endYear(s, { ...s.policy, ...policy, levyRate: s.policy.levyRate }).next;
  return s;
};
const line = (s: { lines: { key: string; amount: number }[] }, key: string) => s.lines.find((l) => l.key === key)?.amount;
/** January 2030, when the levy has expired. */
const jan2030 = play(start, 3);

describe('the levy at the start', () => {
  it('runs at $1.99 through 2029-30 with trust at 30-40', () => {
    expect(start.sim!.levy).toEqual({ rate: 1.99, through: 2029, failures: 0 });
    expect(start.dials.trust).toBeGreaterThanOrEqual(30);
    expect(start.dials.trust).toBeLessThanOrEqual(40);
    expect(ballotPreview(start, DEFAULT_POLICY)).toBeNull();
  });
});

describe('a rate change', () => {
  const asked = { ...DEFAULT_POLICY, levyRate: 1.8 };

  it('goes to voters in May, with a poll and an election bill in the plan', () => {
    const preview = ballotPreview(start, asked)!;
    expect(preview).toMatchObject({ rate: 1.8, when: 'may', renewal: false });
    expect(preview.poll.hi - preview.poll.lo).toBeCloseTo(2 * M.pollSpread);
    expect(line(previewBudget(start, asked), 'election')).toBeLessThan(0);
    expect(line(previewBudget(start, DEFAULT_POLICY), 'election')).toBeUndefined();
  });

  it('takes effect this fall when it passes, for 5 years', () => {
    const { next, report } = endYear(start, asked);
    expect(report.election).toMatchObject({ rate: 1.8, when: 'may', passed: true });
    expect(report.ghostElection).toBeUndefined();
    expect(line(report.budget, 'levy')).toBeCloseTo(levyRevenue(1.8), 0);
    expect(next.policy.levyRate).toBe(1.8);
    expect(next.sim!.levy).toEqual({ rate: 1.8, through: 2031, failures: 0 });
  });

  it('leaves the old levy in force when it fails', () => {
    const doubted = { ...start, sim: { ...start.sim!, levy: { ...start.sim!.levy, failures: 20 } } };
    const { next, facts } = stepYear(doubted, asked);
    expect(facts.election).toMatchObject({ passed: false });
    expect(line(facts.plan, 'levy')).toBeCloseTo(levyRevenue(1.99), 0);
    expect(next.policy.levyRate).toBe(1.99);
    expect(next.sim!.levy.failures).toBe(21);
  });
});

describe('the renewal', () => {
  it('comes up in May 2030 for the player and the ghost alike', () => {
    expect(ballotPreview(jan2030, jan2030.policy)).toMatchObject({ rate: 1.99, when: 'may', renewal: true });
    const { report } = endYear(jan2030, jan2030.policy);
    expect(report.election).toMatchObject({ renewal: true, when: 'may' });
    expect(report.ghostElection).toEqual(report.election);
  });

  it('removes the levy from the June budget when it fails', () => {
    const doubted = { ...jan2030, sim: { ...jan2030.sim!, levy: { ...jan2030.sim!.levy, failures: 20 } } };
    const { next, facts } = stepYear(doubted, jan2030.policy);
    expect(facts.election!.passed).toBe(false);
    expect(line(facts.plan, 'levy')).toBe(0);
    expect(facts.plan.autoCutPositions).toBeGreaterThan(stepYear(jan2030, jan2030.policy).facts.plan.autoCutPositions + 500);
    expect(next.policy.levyRate).toBe(1.99);
    expect(ballotPreview(next, next.policy)).toMatchObject({ renewal: true, when: 'may' });
  });

  it('can renew in November 2029, ahead of expiry', () => {
    const jan2029 = play(start, 2);
    const { next, report } = endYear(jan2029, { ...jan2029.policy, levyElection: 'november' });
    expect(report.election).toMatchObject({ when: 'november', renewal: true });
    expect(report.events.find((e) => e.sourceKey === 'model.election')!.season).toBe('winter');
    expect(next.sim!.levy.through).toBe(report.election!.passed ? 2034 : 2029);
  });

  it('lets a lapse go without a vote while the ghost renews', () => {
    const { report, next } = endYear(jan2030, { ...jan2030.policy, levyRate: 0 });
    expect(report.election).toBeUndefined();
    expect(report.ghostElection).toMatchObject({ renewal: true });
    expect(line(report.budget, 'levy')).toBe(0);
    expect(next.policy.levyRate).toBe(0);
  });
});

describe('family trust', () => {
  it('rises in calm years and falls with closures, against the ghost', () => {
    expect(jan2030.dials.trust).toBeCloseTo(start.dials.trust + 3 * M.trustCalmYear, 0);
    const scenarioA = newGame({ seed: 'levy', start: 'scenario-a' });
    const { next } = endYear(scenarioA, scenarioA.policy);
    expect(SCENARIOS['scenario-a'].closures.length).toBeGreaterThan(10);
    expect(next.dials.trust).toBeLessThan(next.sim!.ghost!.dials.trust - 3);
  });
});

describe('hidden cards', () => {
  it('reveal in the third report with the values this game drew', () => {
    const reports = [0, 1, 2].map((n) => endYear(play(start, n), DEFAULT_POLICY).report);
    expect(reports[0].reveals).toEqual([]);
    expect(reports[1].reveals).toEqual([]);
    expect(reports[2].year).toBe(2029);
    expect(reports[2].reveals).toEqual([
      { sourceKey: 'model.followRate', value: start.sim!.cards.followRate },
      { sourceKey: 'model.closedZoneCapture', value: start.sim!.cards.closedZoneCaptureDrop },
    ]);
  });
});
