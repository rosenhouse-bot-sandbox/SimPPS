import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENARIOS } from '../sim';
import { StartPicker } from './StartPicker';

afterEach(cleanup);

describe('StartPicker', () => {
  it('says what the game is and how a turn works', () => {
    render(<StartPicker onPick={() => {}} />);
    expect([...document.querySelectorAll('.start-picker p.intro')].map((p) => p.textContent)).toEqual([
      "You run Portland Public Schools' K-8 schools, starting in January 2027.",
      'Each year, you plan changes: close schools, redraw boundaries, set class sizes or ask voters for a levy. Then you play the year and see how families respond.',
      'There is no score to win. Each year-end report compares your district with one where nothing changed.',
      'To plan, pick a school or the $ button. To play the year, press ▶︎.',
    ]);
  });

  it('offers the three starts, badging what scenarios leave out', () => {
    const onPick = vi.fn();
    render(<StartPicker onPick={onPick} />);
    expect(screen.getByText("Starts with PPS's 14 proposed closures, 7 grade-span changes and 11 program moves.")).toBeTruthy();
    expect(screen.getByText("Starts with PPS's 11 proposed closures, 7 grade-span changes and 10 program moves.")).toBeTruthy();
    expect(document.querySelectorAll('.badge')).toHaveLength(2);
    expect(screen.getByText(SCENARIOS['scenario-b'].notModeled!).getAttribute('data-source')).toBe('model.scenarios');
    fireEvent.click(screen.getByRole('button', { name: 'PPS Scenario B' }));
    expect(onPick).toHaveBeenCalledWith('scenario-b');
    fireEvent.click(screen.getByRole('button', { name: 'Status quo 2026' }));
    expect(onPick).toHaveBeenLastCalledWith('status-quo');
  });

  it('opens the model parameters and says how many changed', () => {
    const onModel = vi.fn();
    const { rerender } = render(<StartPicker onPick={() => {}} model={{}} onModel={onModel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced: model parameters' }));
    fireEvent.input(screen.getByLabelText('leaveRate'), { target: { value: '0.02' } });
    expect(onModel).toHaveBeenLastCalledWith({ leaveRate: 0.02 });
    rerender(<StartPicker onPick={() => {}} model={{ leaveRate: 0.02 }} onModel={onModel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('This game changes 1 model parameter.')).toBeTruthy();
  });
});
