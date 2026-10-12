import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMedia } from './useMedia';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Probe() {
  return <p>{useMedia('(min-width: 900px)') ? 'wide' : 'narrow'}</p>;
}

describe('useMedia', () => {
  it('follows the query as it changes', () => {
    const list = Object.assign(new EventTarget(), { matches: true });
    const matchMedia = vi.fn(() => list);
    vi.stubGlobal('matchMedia', matchMedia);
    const { container, rerender } = render(<Probe />);
    expect(container.textContent).toBe('wide');
    act(() => {
      list.matches = false;
      list.dispatchEvent(new Event('change'));
    });
    expect(container.textContent).toBe('narrow');
    rerender(<Probe />);
    expect(matchMedia).toHaveBeenCalledTimes(1);
  });

  it('is false without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('narrow');
  });
});
