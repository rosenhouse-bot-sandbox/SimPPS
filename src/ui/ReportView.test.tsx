import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_REPORT } from './fixtures';
import { ReportView } from './ReportView';

afterEach(cleanup);

describe('ReportView', () => {
  it('sorts every kid: those in PPS now add up to Kids, and the rest left', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    for (const [label, n] of [
      ['Stayed', '22,100~'],
      ['Moved in PPS', '820~'],
      ['Came back', '140~'],
      ['New kindergartners', '2,900~'],
      ['Kids now', '25,960~'],
      ['Left PPS', '610~'],
      ['To high school', '3,100~'],
    ]) {
      const row = screen.getByText(label).closest('.flow') as HTMLElement;
      expect(within(row).getByRole('button').textContent).toBe(n);
    }
  });

  it('lists the three largest gaps against the ghost in exact counts', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    const items = document.querySelectorAll('.ghost li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('▲ Positions cut 270 vs 420~');
    expect(items[1].textContent).toBe('▼ Kids 26,050 vs 26,075~');
    expect(items[2].textContent).toBe('▲ Gap −$43M vs −$65.2M~');
  });

  it('prints three sourced Bulletin headlines stamped SIMULATION', () => {
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={() => {}} />);
    const bulletin = screen.getByRole('region', { name: 'The Bulletin' });
    expect(bulletin.textContent).toContain('SIMULATION');
    const items = within(bulletin).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(FIXTURE_REPORT.headlines.slice(0, 3).map((h) => h.text));
    expect(items.map((li) => li.querySelector('[data-source]')?.getAttribute('data-source'))).toEqual(
      FIXTURE_REPORT.headlines.slice(0, 3).map((h) => h.sourceKey),
    );
  });

  it('moves on to the next January', () => {
    const onNext = vi.fn();
    render(<ReportView report={FIXTURE_REPORT} turn={1} onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: 'Plan 2028' }));
    expect(onNext).toHaveBeenCalledOnce();
  });
});
