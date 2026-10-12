import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface WindowProps {
  title: string;
  onClose?: () => void;
  class?: string;
  /** A modal dialog: Tab stays inside and Escape closes it. */
  dialog?: boolean;
  children: ComponentChildren;
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Wraps Tab and Shift-Tab around the focusable elements inside `e.currentTarget`. */
export function trapTab(e: KeyboardEvent) {
  if (e.key !== 'Tab') return;
  const all = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (!all.length) return;
  const [first, last] = [all[0], all[all.length - 1]];
  const at = document.activeElement;
  if (e.shiftKey ? at === first || !all.includes(at as HTMLElement) : at === last) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}

/** Takes focus when it opens and hands it back to the opener when it closes. */
export function Window({ title, onClose, class: cls = '', dialog, children }: WindowProps) {
  const self = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    self.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, []);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!dialog) return;
    if (e.key === 'Escape') onClose?.();
    trapTab(e);
  };
  return (
    <section
      ref={self}
      tabIndex={-1}
      class={`window ${cls}`}
      aria-label={title}
      {...(dialog ? { role: 'dialog', 'aria-modal': 'true' } : {})}
      onKeyDown={onKeyDown}
    >
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
