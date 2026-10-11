import { describe, expect, it, vi } from 'vitest';
import * as sim from '../sim';
import { initApp, makeReducer, mapState, type Action, type AppState } from './machine';

function run(actions: Action[], spy = vi.fn(sim.endYear)) {
  const reduce = makeReducer({ ...sim, endYear: spy });
  return actions.reduce<AppState>(reduce, initApp(sim, 'test'));
}

describe('app state machine', () => {
  it('starts planning January 2027 with no reserve draw', () => {
    const s = run([]);
    expect(s.phase).toBe('plan');
    expect(s.game.year).toBe(2027);
    expect(s.draft.reserveDraw).toBe(0);
  });

  it('edits the draft only while planning', () => {
    expect(run([{ type: 'edit', policy: { k5ClassSize: 26 } }]).draft.k5ClassSize).toBe(26);
    const s = run([{ type: 'preflight' }, { type: 'edit', policy: { k5ClassSize: 26 } }]);
    expect(s.draft.k5ClassSize).toBe(24);
  });

  it('keeps the draft inside the sim\'s bounds', () => {
    const s = run([{ type: 'edit', policy: { k5ClassSize: 40, levyRate: -1 } }]);
    expect(s.draft.k5ClassSize).toBe(28);
    expect(s.draft.levyRate).toBe(0);
  });

  it('restarts the same seed from a PPS scenario, with its closures in the first plan', () => {
    const s = run([{ type: 'preflight' }, { type: 'confirm' }, { type: 'restart', start: 'scenario-b' }]);
    expect(s.phase).toBe('plan');
    expect(s.start).toBe('scenario-b');
    expect(s.history).toEqual([]);
    expect(s.game.seed).toBe('test');
    expect(s.draft.closures.map((c) => c.school)).toEqual(sim.SCENARIOS['scenario-b'].closures.map((c) => c.school));
  });

  it('goes back from pre-flight to plan', () => {
    expect(run([{ type: 'preflight' }, { type: 'back' }]).phase).toBe('plan');
  });

  it('plays the year with the draft on confirm and records the turn', () => {
    const spy = vi.fn(sim.endYear);
    const s = run(
      [{ type: 'edit', policy: { levyRate: 0 } }, { type: 'preflight' }, { type: 'confirm' }],
      spy,
    );
    expect(s.phase).toBe('playing');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][1].levyRate).toBe(0);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].start.year).toBe(2027);
    expect(s.history[0].end.year).toBe(2028);
    expect(s.game.year).toBe(2027);
  });

  it('cannot confirm without the pre-flight sheet', () => {
    const spy = vi.fn(sim.endYear);
    expect(run([{ type: 'confirm' }], spy).phase).toBe('plan');
    expect(spy).not.toHaveBeenCalled();
  });

  it('runs report then the next January, keeping history', () => {
    const year: Action[] = [{ type: 'preflight' }, { type: 'confirm' }, { type: 'playbackDone' }];
    const atReport = run(year);
    expect(atReport.phase).toBe('report');
    const s = run([...year, { type: 'nextYear' }, ...year, { type: 'nextYear' }]);
    expect(s.phase).toBe('plan');
    expect(s.game.year).toBe(2029);
    expect(s.history.map((t) => t.start.year)).toEqual([2027, 2028]);
  });

  it('clears the once-only reserve draw for the next plan', () => {
    const s = run([
      { type: 'edit', policy: { reserveDraw: 5e6 } },
      { type: 'preflight' },
      { type: 'confirm' },
      { type: 'playbackDone' },
      { type: 'nextYear' },
    ]);
    expect(s.history[0].policy.reserveDraw).toBe(5e6);
    expect(s.draft.reserveDraw).toBe(0);
  });
});

describe('mapState', () => {
  const playing = run([{ type: 'preflight' }, { type: 'confirm' }]);
  const turn = playing.history[0];

  it('shows the planned state before the year plays', () => {
    const s = run([]);
    expect(mapState(s, 'spring')).toBe(s.game);
  });

  it('shows closed buildings from summer on', () => {
    expect(mapState(playing, 'summer').schools).toBe(turn.end.schools);
    expect(mapState(playing, 'summer').households).toBe(turn.start.households);
  });

  it('shows where kids went from fall on', () => {
    expect(mapState(playing, 'fall')).toBe(turn.end);
    expect(mapState(playing, 'winter')).toBe(turn.end);
    expect(mapState({ ...playing, phase: 'report' }, 'spring')).toBe(turn.end);
  });
});
