import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_REPORT } from './fixtures';
import { Playback } from './Playback';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Playback', () => {
  it('plays five seasons in order and then finishes', () => {
    const onDone = vi.fn();
    const onSeason = vi.fn();
    render(<Playback report={FIXTURE_REPORT} onDone={onDone} onSeason={onSeason} durationMs={5000} />);
    expect(screen.getByText('Spring')).toBeTruthy();
    expect(screen.getByText('Lottery runs')).toBeTruthy();
    tick(1000);
    expect(screen.getByText('Summer')).toBeTruthy();
    expect(screen.queryByText('Lottery runs')).toBeNull();
    tick(1000);
    expect(screen.getByText('Fall')).toBeTruthy();
    tick(1000);
    expect(screen.getByText('October')).toBeTruthy();
    tick(1000);
    expect(screen.getByText('Winter')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    tick(1000);
    expect(onDone).toHaveBeenCalledOnce();
    expect(onSeason.mock.calls.map((c) => c[0])).toEqual(['spring', 'summer', 'fall', 'october', 'winter']);
  });

  it('pauses on tap and resumes on a second tap', () => {
    const onDone = vi.fn();
    render(<Playback report={FIXTURE_REPORT} onDone={onDone} durationMs={5000} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    tick(10_000);
    expect(screen.getByText('Spring')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    tick(5000);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('skips to the report once', () => {
    const onDone = vi.fn();
    render(<Playback report={FIXTURE_REPORT} onDone={onDone} durationMs={5000} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    tick(10_000);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('makes each event line, numbers included, open its source', () => {
    render(<Playback report={FIXTURE_REPORT} onDone={() => {}} durationMs={5000} />);
    const line = document.querySelector('.ticker [data-source="model.kCapture"]')!;
    expect(line.textContent).toBe('Lottery runs Entering families choose schools.');
  });

  it('says so when a season has no events', () => {
    render(<Playback report={{ ...FIXTURE_REPORT, events: [] }} onDone={() => {}} durationMs={5000} />);
    expect(screen.getByText('A quiet season.')).toBeTruthy();
  });
});
