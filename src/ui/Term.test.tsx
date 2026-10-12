import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary';
import { Sourced } from './Sourced';
import { Term } from './Term';

afterEach(cleanup);

describe('Term', () => {
  it('opens its plain-language definition', () => {
    render(<Term t="URM" />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'What is URM?' }));
    const dialog = screen.getByRole('dialog', { name: 'URM' });
    expect(dialog.textContent).toContain(GLOSSARY.URM);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('takes focus and gives it back on Escape', () => {
    render(<Term t="DLI" />);
    const opener = screen.getByRole('button', { name: 'What is DLI?' });
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('names other wording first, so the name contains the visible label', () => {
    render(<Term t="Reserves">Reserves after</Term>);
    expect(screen.getByRole('button', { name: 'Reserves after, what is Reserves?' }).textContent).toBe('Reserves after');
  });

  it('shows only a mark beside a label that already names the term', () => {
    render(<Term t="Slice" icon />);
    expect(screen.getByRole('button', { name: 'What is Slice?' }).textContent).toBe('');
  });
});

describe('Sourced with a term', () => {
  it('shows the definition above a field source', () => {
    render(
      <Sourced k="field.is_urm_building" term="URM">
        Yes
      </Sourced>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    const body = screen.getByRole('dialog').querySelector('.window-body')!;
    expect(body.firstElementChild!.textContent).toBe(GLOSSARY.URM);
    expect(body.textContent).toContain('[F] public source');
  });

  it('shows the definition above a model source', () => {
    render(
      <Sourced k="dial.trust" term="Trust">
        35
      </Sourced>,
    );
    fireEvent.click(screen.getByRole('button', { name: '35' }));
    const body = screen.getByRole('dialog', { name: 'Trust' }).querySelector('.window-body')!;
    expect(body.firstElementChild!.textContent).toBe(GLOSSARY.Trust);
    expect(body.textContent).toContain('[M] model assumption');
  });
});
