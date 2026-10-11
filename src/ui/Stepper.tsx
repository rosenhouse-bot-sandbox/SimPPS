import type { ComponentChildren } from 'preact';
import { clamp } from './levers';

interface StepperProps {
  label: string;
  /** Replaces the plain label, e.g. with a sourced one. */
  labelNode?: ComponentChildren;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}

/** Rounds away float drift such as 1.8900000000000001. */
function tidy(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function Stepper({ label, labelNode, value, min, max, step, format, onChange }: StepperProps) {
  const set = (n: number) => {
    const next = clamp(tidy(n), min, max);
    if (next !== value) onChange(next);
  };
  return (
    <div class="stepper row" role="group" aria-label={label}>
      <span class="stepper-label">{labelNode ?? label}</span>
      <button type="button" class="step" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => set(value - step)}>
        −
      </button>
      <output class="num stepper-value">{format(value)}</output>
      <button type="button" class="step" aria-label={`More ${label}`} disabled={value >= max} onClick={() => set(value + step)}>
        +
      </button>
    </div>
  );
}
