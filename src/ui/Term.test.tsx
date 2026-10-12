import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GLOSSARY, type GlossaryTerm } from './glossary';
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

  it('can show a short form of its term', () => {
    render(<Term t="Capture">Cap</Term>);
    expect(screen.getByRole('button', { name: 'What is Capture?' }).textContent).toBe('Cap');
  });

  it('refuses a term with no definition', () => {
    expect(() => render(<Term t={'Flux capacitor' as GlossaryTerm} />)).toThrow('No definition for "Flux capacitor"');
  });
});

describe('Sourced with a term', () => {
  it('shows the definition above the source', () => {
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
});
