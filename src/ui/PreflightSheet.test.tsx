import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_POLICY, type BallotPreview } from '../sim';
import { FIXTURE_GAME } from './fixtures';
import { PLAY_ARM_MS, PreflightSheet } from './PreflightSheet';
import { termsIn } from './terms.testing';

afterEach(cleanup);

function sheet(year: number, ballot: BallotPreview | null = null) {
  const noop = () => {};
  render(
    <PreflightSheet
      year={year}
      draft={DEFAULT_POLICY}
      base={DEFAULT_POLICY}
      budget={FIXTURE_GAME.budget}
      ballot={ballot}
      onBack={noop}
      onConfirm={noop}
    />,
  );
  return screen.getByRole('dialog', { name: /^Play/ }).textContent;
}

describe('PreflightSheet', () => {
  it('goes back on Escape', () => {
    const onBack = vi.fn();
    render(
      <PreflightSheet year={2027} draft={DEFAULT_POLICY} base={DEFAULT_POLICY} budget={FIXTURE_GAME.budget} ballot={null} onBack={onBack} onConfirm={() => {}} />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('plays on one click once a double-tap on ▶ could no longer land on Play', () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    render(
      <PreflightSheet year={2027} draft={DEFAULT_POLICY} base={DEFAULT_POLICY} budget={FIXTURE_GAME.budget} ballot={null} onBack={() => {}} onConfirm={onConfirm} />,
    );
    const play = screen.getByRole('button', { name: 'Play' });
    expect(play).toHaveProperty('disabled', true);
    fireEvent.click(play);
    expect(onConfirm).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(PLAY_ARM_MS);
    });
    fireEvent.click(play);
    expect(onConfirm).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("lists the programs the plan's closures carry", () => {
    render(
      <PreflightSheet
        year={2027}
        draft={DEFAULT_POLICY}
        base={DEFAULT_POLICY}
        budget={FIXTURE_GAME.budget}
        ballot={null}
        closurePrograms={[{ program: 'Japanese', from: ['richmond'], to: 'glencoe' }]}
        onBack={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Japanese DLI moves to Glencoe' }).getAttribute('data-source')).toBe('model.programMove');
  });

  it('lists the ballot item with its poll, booked as passing', () => {
    const text = sheet(2030, { rate: 1.99, when: 'may', renewal: true, poll: { lo: 0.72, hi: 0.82 } });
    expect(text).toContain('BallotMay 2030 levy renewal$1.99 per $1K · poll 72–82%~');
    expect(text).toContain('The plan books it as passing.');
    cleanup();
    expect(sheet(2029, { rate: 1.99, when: 'november', renewal: true, poll: { lo: 0.72, hi: 0.82 } })).not.toContain('books it');
    cleanup();
    expect(sheet(2027)).toContain('BallotNone');
  });

  it('warns that odd-year plans assume flat state funding', () => {
    expect(sheet(2029)).toContain('At flat state funding.');
    cleanup();
    expect(sheet(2028)).not.toContain('flat state funding');
  });
});

describe('PreflightSheet glossary', () => {
  it('defines the gap and automatic cuts', () => {
    sheet(2027);
    expect(termsIn()).toEqual(['Gap', 'Automatic cuts']);
  });
});
