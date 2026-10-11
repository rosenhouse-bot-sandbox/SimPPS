import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_REPORT } from './fixtures';
import { ReportView } from './ReportView';

afterEach(cleanup);

describe('ReportView', () => {
  it('shows where kids went as modeled counts', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    for (const [label, n] of [
      ['Stayed', '24.1K~'],
      ['Moved in PPS', '820~'],
      ['Left PPS', '610~'],
      ['Came back', '140~'],
    ]) {
      const row = screen.getByText(label).closest('.flow') as HTMLElement;
      expect(within(row).getByRole('button').textContent).toBe(n);
    }
  });

  it('lists the three largest gaps against the ghost', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    const items = document.querySelectorAll('.ghost li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('▲ Positions cut 270 vs 420~');
    expect(items[2].textContent).toBe('▲ Gap −$43M vs −$65.2M~');
  });

  it('prints three Bulletin headlines stamped SIMULATION', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    const bulletin = screen.getByRole('region', { name: 'The Bulletin' });
    expect(bulletin.textContent).toContain('SIMULATION');
    expect(within(bulletin).getAllByRole('listitem').map((li) => li.textContent)).toEqual(FIXTURE_REPORT.headlines.slice(0, 3));
  });

  it('moves on to the next January', () => {
    const onNext = vi.fn();
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plan 2028' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
