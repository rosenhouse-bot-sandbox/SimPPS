import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { Window } from './Window';

afterEach(cleanup);

describe('Window', () => {
  it('takes focus when it opens, so the keyboard lands inside', () => {
    render(
      <Window title="Budget">
        <button type="button">Inside</button>
      </Window>,
    );
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Budget' }));
  });

  it('hands focus back to the button that opened it', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(<Window title="Budget">x</Window>);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('as a dialog, is modal and keeps Tab inside', () => {
    render(
      <Window title="Play?" dialog>
        <button type="button">First</button>
        <button type="button">Last</button>
      </Window>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Play?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    screen.getByRole('button', { name: 'Last' }).focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
  });
});
