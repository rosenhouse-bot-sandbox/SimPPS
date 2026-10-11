import { describe, expect, it, vi } from 'vitest';
import * as sim from '../sim';
import { initApp, makeReducer, type Action, type AppState } from './machine';

function run(actions: Action[], spy = vi.fn(sim.endYear)) {
  const reduce = makeReducer({ newGame: sim.newGame, endYear: spy });
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
