import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoldButton } from './HoldButton';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup() {
  const onConfirm = vi.fn();
  render(
    <HoldButton label="End year" onConfirm={onConfirm}>
      End
    </HoldButton>,
  );
  return { onConfirm, button: screen.getByRole('button', { name: 'End year (press and hold)' }) };
}

describe('HoldButton', () => {
  it('confirms after a one-second hold', () => {
    const { onConfirm, button } = setup();
    fireEvent.pointerDown(button);
    vi.advanceTimersByTime(999);
    expect(onConfirm).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('blocks the long-press menu', () => {
    render(<HoldButton label="End year" onConfirm={() => {}}>End</HoldButton>);
    const b = screen.getByRole('button');
    expect(fireEvent.contextMenu(b)).toBe(false);
  });

  it('does nothing on a short press or a click', () => {
    const { onConfirm, button } = setup();
    fireEvent.pointerDown(button);
    vi.advanceTimersByTime(500);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    vi.advanceTimersByTime(2000);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels when the finger slides off', () => {
    const { onConfirm, button } = setup();
    fireEvent.pointerDown(button);
    fireEvent.pointerLeave(button);
    vi.advanceTimersByTime(2000);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms when Space is held for a second', () => {
    const { onConfirm, button } = setup();
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyDown(button, { key: ' ', repeat: true });
    vi.advanceTimersByTime(1000);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels when Enter is released early', () => {
    const { onConfirm, button } = setup();
    fireEvent.keyDown(button, { key: 'Enter' });
    vi.advanceTimersByTime(300);
    fireEvent.keyUp(button, { key: 'Enter' });
    vi.advanceTimersByTime(2000);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
