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
    fireEvent.click(screen.getByRole('button', { name: 'Less Levy' }));
    expect(onChange.mock.calls).toEqual([[2], [1.89]]);
  });
});
