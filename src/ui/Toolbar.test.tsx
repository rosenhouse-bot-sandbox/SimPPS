import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';

afterEach(cleanup);

describe('Toolbar', () => {
  it('asks to play the year on one click', () => {
    const onPlay = vi.fn();
    render(<Toolbar active="map" onPick={() => {}} onPlay={onPlay} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play the year' }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('disables play outside planning', () => {
    render(<Toolbar active="map" onPick={() => {}} onPlay={() => {}} disabled />);
    expect(screen.getByRole('button', { name: 'Play the year' })).toHaveProperty('disabled', true);
  });
});
