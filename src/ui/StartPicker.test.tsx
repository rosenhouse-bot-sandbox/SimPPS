import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENARIOS } from '../sim';
import { StartPicker } from './StartPicker';

afterEach(cleanup);

describe('StartPicker', () => {
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
