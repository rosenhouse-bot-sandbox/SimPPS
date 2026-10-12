import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENARIOS } from '../sim';
import { StartPicker } from './StartPicker';

afterEach(cleanup);

describe('StartPicker', () => {
  it('says what the game is and how a turn works', () => {
    render(<StartPicker onPick={() => {}} />);
    expect(screen.getByText(/^You run Portland Public Schools/).textContent).toBe(
      "You run Portland Public Schools' K-8 schools and budget. There is no win: watch kids, money and trust against a ghost who changes nothing.",
    );
    expect(screen.getByText(/hold End/).textContent).toBe('Each January, tap a school or $ to plan, then hold End to play the year.');
  });

  it('offers the three starts, badging what scenarios leave out', () => {
    const onPick = vi.fn();
    render(<StartPicker onPick={onPick} />);
    expect(screen.getByText('14 closures load as your first plan.')).toBeTruthy();
    expect(screen.getByText('11 closures load as your first plan.')).toBeTruthy();
    expect(document.querySelectorAll('.badge')).toHaveLength(2);
    expect(screen.getByText(SCENARIOS['scenario-b'].notModeled!).getAttribute('data-source')).toBe('model.scenarios');
    fireEvent.click(screen.getByRole('button', { name: 'PPS Scenario B' }));
    expect(onPick).toHaveBeenCalledWith('scenario-b');
    fireEvent.click(screen.getByRole('button', { name: 'Status quo 2026' }));
    expect(onPick).toHaveBeenLastCalledWith('status-quo');
  });
});
