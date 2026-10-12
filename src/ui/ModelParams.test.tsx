import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODEL_DEFAULTS } from '../sim/model';
import { ModelParams } from './ModelParams';

afterEach(cleanup);

const input = (path: string) => screen.getByLabelText(path) as HTMLInputElement;
const row = (path: string) => input(path).closest('li')!;

describe('ModelParams', () => {
  it('lists every parameter under its source, with its tag, note and value', () => {
    render(<ModelParams model={{}} onChange={() => {}} onClose={() => {}} />);
    expect(input('leaveRate').value).toBe(String(MODEL_DEFAULTS.leaveRate));
    expect(input('closureOneTime.lo').value).toBe('300000');
    expect(row('leaveRate').textContent).toContain('[M]');
    expect(row('leaveRate').textContent).toContain('Share of PPS kids who leave each year.');
    expect(row('leaveRate').closest('section')!.querySelector('h3 [data-source]')!.getAttribute('data-source')).toBe('model.movingRoll');
    expect(screen.getByText('staffSteps').closest('li')!.querySelector('input')).toBeNull();
  });

  it('reports valid changes, marks them and offers a reset', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ModelParams model={{}} onChange={onChange} onClose={() => {}} />);
    fireEvent.input(input('leaveRate'), { target: { value: '0.02' } });
    expect(onChange).toHaveBeenLastCalledWith({ leaveRate: 0.02 });
    rerender(<ModelParams model={{ leaveRate: 0.02 }} onChange={onChange} onClose={() => {}} />);
    expect(row('leaveRate').classList.contains('changed')).toBe(true);
    expect(row('leaveRate').textContent).toContain('Default 0.015.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('flags values out of bounds and leaves them out', () => {
    const onChange = vi.fn();
    render(<ModelParams model={{}} onChange={onChange} onClose={() => {}} />);
    fireEvent.input(input('leaveRate'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({});
    expect(row('leaveRate').textContent).toContain('Use 0 to 1.');
    expect(input('leaveRate').getAttribute('aria-invalid')).toBe('true');
    fireEvent.input(input('closureOneTime.lo'), { target: { value: '700000' } });
    expect(row('closureOneTime.lo').textContent).toContain('Keep low at or below high.');
    fireEvent.input(input('closureOneTime.hi'), { target: { value: '800000' } });
    expect(onChange).toHaveBeenLastCalledWith({ 'closureOneTime.lo': 700_000, 'closureOneTime.hi': 800_000 });
  });
});
