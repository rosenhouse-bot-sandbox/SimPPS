import type { ComponentChildren } from 'preact';

interface WindowProps {
  title: string;
  onClose?: () => void;
  class?: string;
  children: ComponentChildren;
}

export function Window({ title, onClose, class: cls = '', children }: WindowProps) {
  return (
    <section class={`window ${cls}`} aria-label={title}>
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
