import { cleanup, render, screen } from '@testing-library/preact';
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
});
