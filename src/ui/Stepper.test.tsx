import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stepper } from './Stepper';

afterEach(cleanup);

function setup(value: number) {
  const onChange = vi.fn();
  render(<Stepper label="Class size" value={value} min={22} max={28} step={1} format={String} onChange={onChange} />);
  return {
    onChange,
    less: screen.getByRole('button', { name: 'Less Class size' }) as HTMLButtonElement,
    more: screen.getByRole('button', { name: 'More Class size' }) as HTMLButtonElement,
  };
}

describe('Stepper', () => {
  it('steps by one', () => {
    const { onChange, more, less } = setup(24);
    fireEvent.click(more);
    fireEvent.click(less);
    expect(onChange.mock.calls).toEqual([[25], [23]]);
  });

  it('stops at the top', () => {
    const { onChange, more } = setup(28);
    expect(more.disabled).toBe(true);
    fireEvent.click(more);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops at the bottom', () => {
    expect(setup(22).less.disabled).toBe(true);
  });

  it('clamps a step that would overshoot', () => {
    const onChange = vi.fn();
    render(<Stepper label="Levy" value={1.99} min={0} max={2} step={0.1} format={String} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'More Levy' }));
    expect(onChange.mock.calls).toEqual([[2]]);
  });

  it('steps on a grid through the anchor, so the anchor is always reachable', () => {
    const steps = (value: number, dir: 'More' | 'Less') => {
      const onChange = vi.fn();
      render(
        <Stepper label="Levy" value={value} min={0} max={2} step={0.1} anchor={1.99} format={String} onChange={onChange} />,
      );
      fireEvent.click(screen.getByRole('button', { name: `${dir} Levy` }));
      cleanup();
      return onChange.mock.calls[0][0];
    };
    expect(steps(1.99, 'More')).toBe(2);
    expect(steps(2, 'Less')).toBe(1.99);
    expect(steps(1.99, 'Less')).toBe(1.89);
    expect(steps(0.09, 'Less')).toBe(0);
    expect(steps(0, 'More')).toBe(0.09);
  });

  it('sources its value when given a key', () => {
    render(<Stepper label="Class size" sourceKey="ui.k5ClassSize" value={24} min={22} max={28} step={1} format={String} onChange={() => {}} />);
    expect(document.querySelector('.stepper-value [data-source="ui.k5ClassSize"]')!.textContent).toBe('24');
  });
});
