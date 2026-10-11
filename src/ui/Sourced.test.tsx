import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { registerSources } from '../sources/registry';
import { Sourced } from './Sourced';

afterEach(cleanup);

describe('Sourced', () => {
  it('opens a pop-over with the source for its key', () => {
    render(<Sourced k="field.year_built">1952</Sourced>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1952' }));
    const dialog = screen.getByRole('dialog', { name: 'Year built' });
    expect(dialog.textContent).toContain('[F] public source');
    expect(dialog.querySelector('a')?.getAttribute('href')).toBe('https://github.com/meub/pps-data');
  });

  it('marks modeled values with "~"', () => {
    render(
      <Sourced k="sim.enrollment" modeled>
        190–225
      </Sourced>,
    );
    fireEvent.click(screen.getByRole('button', { name: '190–225~' }));
    expect(screen.getByRole('dialog').textContent).toContain('[M] model assumption');
  });

  it('closes on Escape', () => {
    render(<Sourced k="dial.gap">−$65M</Sourced>);
    fireEvent.click(screen.getByRole('button', { name: '−$65M' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps hidden cards hidden', () => {
    registerSources([
      {
        key: 'test.hidden',
        label: 'Follow rate',
        tag: 'M',
        explain: 'Share of a closed school that follows.',
        links: [],
        hidden: { outcomes: [{ value: 0.95, label: '95%', weight: 1 }], revealAfterYears: 3 },
      },
    ]);
    render(<Sourced k="test.hidden">?</Sourced>);
    fireEvent.click(screen.getByRole('button', { name: '?' }));
    const text = screen.getByRole('dialog').textContent!;
    expect(text).toContain('Hidden until year 3');
    expect(text).not.toContain('95%');
  });
});
