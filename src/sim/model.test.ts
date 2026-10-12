import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, endYear, newGame } from '.';
import { M, MODEL_DEFAULTS, setModelParams } from './model';

describe('setModelParams', () => {
  it('applies overrides over the defaults, ranges by "lo" and "hi"', () => {
    setModelParams({ trustClosure: 12, 'closureOneTime.lo': 100_000 });
    expect(M.trustClosure).toBe(12);
    expect(M.closureOneTime).toEqual({ lo: 100_000, hi: MODEL_DEFAULTS.closureOneTime.hi });
    setModelParams({ leaveRate: 0.02 });
    expect(M.trustClosure).toBe(MODEL_DEFAULTS.trustClosure);
    expect(M.closureOneTime).toEqual(MODEL_DEFAULTS.closureOneTime);
    expect(M.leaveRate).toBe(0.02);
  });

  it('ignores unknown keys and values that are not finite numbers', () => {
    setModelParams({ nope: 1, staffSteps: 3, leaveRate: NaN, 'trustStart.mid': 2, returnRate: Infinity } as never);
    expect(M).toEqual(MODEL_DEFAULTS);
  });

  it('keeps the defaults frozen', () => {
    expect(Object.isFrozen(MODEL_DEFAULTS)).toBe(true);
    expect(Object.isFrozen(MODEL_DEFAULTS.trustStart)).toBe(true);
  });
});

describe('the Classrooms dial', () => {
  it('shows the average K-5 class until a two-section floor is set', () => {
    expect(newGame({ seed: 'dial' }).dials.k5Class).toBeCloseTo(25, 0);
    const counted = newGame({ seed: 'dial', model: { classroomsK5: 276 } }).dials;
    expect(counted.k5Class).toBeGreaterThan(5_000);
    expect(counted.k5Class).toBeLessThan(counted.kids);
    expect(newGame({ seed: 'dial', model: { classroomsK5: 276, classroomsMiddle: 1e6 } }).dials.k5Class).toBeLessThan(counted.k5Class);
  });
});

describe('a game with changed parameters', () => {
  const kidsAfterYear = (model?: Record<string, number>) => endYear(newGame({ seed: 'params', model }), DEFAULT_POLICY).next;

  it('changes a seeded outcome, ghost included, while the defaults reproduce it', () => {
    const before = kidsAfterYear();
    const changed = kidsAfterYear({ leaveRate: 0.05 });
    const again = kidsAfterYear({});
    expect(changed.dials.kids).toBeLessThan(before.dials.kids - 300);
    expect(changed.sim!.ghost!.dials.kids).toBeLessThan(before.sim!.ghost!.dials.kids - 300);
    expect(again.dials).toEqual(before.dials);
  });

  it('keeps its own parameters when another game starts in between', () => {
    const game = newGame({ seed: 'params', model: { leaveRate: 0.05 } });
    newGame({ seed: 'other' });
    expect(endYear(game, DEFAULT_POLICY).next.dials).toEqual(kidsAfterYear({ leaveRate: 0.05 }).dials);
    expect(game.sim!.model).toEqual({ leaveRate: 0.05 });
  });
});
