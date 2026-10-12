import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';

afterEach(cleanup);

describe('Toolbar', () => {
  it('asks to play the year on one click', () => {
    const onPlay = vi.fn();
    render(<Toolbar active="map" onPick={() => {}} onPlay={onPlay} disabled={false} canPlay />);
    fireEvent.click(screen.getByRole('button', { name: 'Play the year' }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('keeps play enabled while the other tools are disabled', () => {
    render(<Toolbar active="map" onPick={() => {}} onPlay={() => {}} disabled canPlay />);
    expect(screen.getByRole('button', { name: 'Play the year' })).toHaveProperty('disabled', false);
  });

  it('disables play when it cannot play', () => {
    render(<Toolbar active="map" onPick={() => {}} onPlay={() => {}} disabled canPlay={false} />);
    expect(screen.getByRole('button', { name: 'Play the year' })).toHaveProperty('disabled', true);
  });
});
