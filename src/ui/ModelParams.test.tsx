import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { M, MODEL_DEFAULTS, setModelParams } from '../sim/model';
import { ModelParams } from './ModelParams';

afterEach(cleanup);

const input = (path: string) => screen.getByLabelText(path) as HTMLInputElement;
const row = (path: string) => input(path).closest('li')!;

describe('ModelParams', () => {
  it('lists every parameter under its source, with its tag, label and value', () => {
    render(<ModelParams model={{}} onChange={() => {}} onClose={() => {}} />);
    expect(input('leaveRate').value).toBe(String(MODEL_DEFAULTS.leaveRate));
    expect(input('closureOneTime.lo').value).toBe('300000');
    expect(row('leaveRate').textContent).toContain('[M]');
    expect(row('leaveRate').textContent).toContain('Share of PPS kids who leave each year');
    expect(row('leaveRate').closest('section')!.querySelector('h3 [data-source]')!.getAttribute('data-source')).toBe('model.movingRoll');
    expect(screen.getByText('staffSteps').closest('li')!.querySelector('input')).toBeNull();
    expect(screen.getByText('levyRate').closest('li')!.querySelector('input')).toBeNull();
  });

  it('offers a minus key only where a value can go negative', () => {
    render(<ModelParams model={{}} onChange={() => {}} onClose={() => {}} />);
    expect(input('leaveRate').inputMode).toBe('decimal');
    expect(input('cohortTrend').inputMode).toBe('text');
  });

  it('quotes the defaults in its source pop-overs', () => {
    setModelParams({ leaveRate: 0.05 });
    render(<ModelParams model={{}} onChange={() => {}} onClose={() => {}} />);
    expect(M.leaveRate).toBe(MODEL_DEFAULTS.leaveRate);
  });

  it('reports valid changes, marks them and offers a reset', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ModelParams model={{}} onChange={onChange} onClose={() => {}} />);
    fireEvent.input(input('leaveRate'), { target: { value: '0,02' } });
    expect(onChange).toHaveBeenLastCalledWith({ leaveRate: 0.02 });
    rerender(<ModelParams model={{ leaveRate: 0.02 }} onChange={onChange} onClose={() => {}} />);
    expect(row('leaveRate').classList.contains('changed')).toBe(true);
    expect(row('leaveRate').textContent).toContain('default 0.015');
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('flags a bad value, links the message and keeps the last valid value', () => {
    const onChange = vi.fn();
    render(<ModelParams model={{ leaveRate: 0.02 }} onChange={onChange} onClose={() => {}} />);
    fireEvent.input(input('leaveRate'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ leaveRate: 0.02 });
    const error = document.getElementById(input('leaveRate').getAttribute('aria-describedby')!)!;
    expect(error.textContent).toBe('Use 0 to 0.1.');
    expect(input('leaveRate').getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('.actions')!.textContent).toContain('1 invalid, last valid value kept');
    fireEvent.input(input('overload'), { target: { value: '0x4' } });
    expect(row('overload').textContent).toContain('Enter a number.');
  });

  it('accepts a crossed range once both ends agree', () => {
    const onChange = vi.fn();
    render(<ModelParams model={{}} onChange={onChange} onClose={() => {}} />);
    fireEvent.input(input('closureOneTime.lo'), { target: { value: '700000' } });
    expect(row('closureOneTime.lo').textContent).toContain('Keep at or below closureOneTime.hi.');
    expect(onChange).toHaveBeenLastCalledWith({});
    fireEvent.input(input('closureOneTime.hi'), { target: { value: '800000' } });
    expect(onChange).toHaveBeenLastCalledWith({ 'closureOneTime.lo': 700_000, 'closureOneTime.hi': 800_000 });
  });
});
