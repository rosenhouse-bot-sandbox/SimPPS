import type { ComponentChildren } from 'preact';
import { clamp } from '../clamp';
import type { GlossaryTerm } from './glossary';
import { Sourced } from './Sourced';

interface StepperProps {
  label: string;
  /** Replaces the plain label, e.g. with a sourced one. */
  labelNode?: ComponentChildren;
  sourceKey?: string;
  /** The glossary term the value belongs to. */
  term?: GlossaryTerm;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Steps land on anchor + k × step, then clamp to min and max. Defaults to min. */
  anchor?: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}

/** Rounds away float drift such as 1.8900000000000001. */
function tidy(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function Stepper({ label, labelNode, sourceKey, term, value, min, max, step, anchor = min, format, onChange }: StepperProps) {
  const k = (value - anchor) / step;
  const set = (n: number) => {
    const next = clamp(tidy(n), min, max);
    if (next !== value) onChange(next);
  };
  const up = () => set(anchor + (Math.floor(k + 1e-9) + 1) * step);
  const down = () => set(anchor + (Math.ceil(k - 1e-9) - 1) * step);
  const shown = format(value);
  return (
    <div class="stepper row" role="group" aria-label={label}>
      <span class="stepper-label">{labelNode ?? label}</span>
      <button type="button" class="step" aria-label={`Less ${label}`} disabled={value <= min} onClick={down}>
        −
      </button>
      <output class="num stepper-value">{sourceKey ? <Sourced k={sourceKey} term={term}>
          {shown}
        </Sourced> : shown}</output>
      <button type="button" class="step" aria-label={`More ${label}`} disabled={value >= max} onClick={up}>
        +
      </button>
    </div>
  );
}
