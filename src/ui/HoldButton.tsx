import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface HoldButtonProps {
  onConfirm: () => void;
  children: ComponentChildren;
  /** Accessible name; says that a hold is needed. */
  label: string;
  ms?: number;
  class?: string;
}

/** Fires after a press of `ms` by pointer, or by holding Enter or Space. */
export function HoldButton({ onConfirm, children, label, ms = 1000, class: cls = '' }: HoldButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const byKey = useRef(false);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  /** A release before the hold completes says what to do. */
  const release = () => {
    if (!timer.current) return;
    cancel();
    setHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1500);
  };
  const start = (key: boolean) => {
    if (timer.current) return;
    byKey.current = key;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, ms);
  };
  useEffect(
    () => () => {
      cancel();
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  return (
    <button
      type="button"
      class={`hold ${holding ? 'holding' : ''} ${cls}`}
      style={{ '--hold-ms': `${ms}ms` }}
      aria-label={`${label} (press and hold)`}
      onPointerDown={() => start(false)}
      onPointerUp={release}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start(true);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') release();
      }}
      onBlur={() => byKey.current && cancel()}
    >
      <span class="hold-fill" aria-hidden="true" />
      <span class="hold-label">{hint ? 'Hold' : children}</span>
    </button>
  );
}
