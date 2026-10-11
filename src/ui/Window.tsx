import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface WindowProps {
  title: string;
  onClose?: () => void;
  class?: string;
  children: ComponentChildren;
}

/** Takes focus when it opens. */
export function Window({ title, onClose, class: cls = '', children }: WindowProps) {
  const self = useRef<HTMLElement>(null);
  useEffect(() => self.current?.focus(), []);
  return (
    <section ref={self} tabIndex={-1} class={`window ${cls}`} aria-label={title}>
      <div class="titlebar">
        <span>{title}</span>
        {onClose && (
          <button type="button" class="close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        )}
      </div>
      <div class="window-body">{children}</div>
    </section>
  );
}
