import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fmtRange } from '../format';
import { modeledRange } from '../sim';
import { SendGradesSheet } from './SendGradesSheet';
import type { Candidate } from './closeSend';

afterEach(cleanup);

const candidates: Candidate[] = ['Beaumont', 'Harriet Tubman', 'Roseway Heights', 'Mt Tabor', 'Ockley Green', 'Gray'].map((name, i) => ({
  id: name.toLowerCase().replace(' ', '-'),
  name,
  miles: 1 + i,
  kids: 500,
  capacity: 700,
}));
const chip = { kidsMoving: 120, seats: { kids: 680, capacity: 700 } };

function sheet(props: Partial<Parameters<typeof SendGradesSheet>[0]> = {}) {
  const on = { onPick: vi.fn(), onCommit: vi.fn(), onClose: vi.fn() };
  render(<SendGradesSheet school="beverly-cleary" candidates={candidates} to={null} chip={null} {...on} {...props} />);
  return on;
}

describe('SendGradesSheet', () => {
  it('lists the nearest middle schools and picks one', () => {
    const { onPick } = sheet();
    expect(screen.getByRole('region', { name: 'Send Beverly Cleary 6–8' })).toBeTruthy();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(5);
    expect(screen.queryByText('Gray')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'All schools A–Z' }));
    expect(screen.getByText('Gray')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Harriet Tubman/ }));
    expect(onPick).toHaveBeenCalledWith('harriet-tubman');
    expect((screen.getByRole('button', { name: 'Send 6–8' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the arithmetic and commits the change', () => {
    const { onCommit } = sheet({ to: 'beaumont', chip });
    expect(screen.getByRole('button', { name: /Beaumont/ }).getAttribute('aria-pressed')).toBe('true');
    const moving = fmtRange(modeledRange(120));
    expect(screen.getByTestId('conversion-chip').textContent).toBe(`Seats${fmtRange(modeledRange(680))}/700${moving} 6th and 7th graders must choose.`);
    expect(screen.getByRole('button', { name: moving }).getAttribute('data-source')).toBe('model.gradeSpan');
    fireEvent.click(screen.getByRole('button', { name: 'Send 6–8' }));
    expect(onCommit).toHaveBeenCalledWith({ school: 'beverly-cleary', to: 'beaumont' });
  });
});
