import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { getSource, type Source, type SourceTag } from '../sources/registry';
import './sources';

export const TAG_NAMES: Record<SourceTag, string> = {
  F: 'public source',
  N: 'news',
  I: 'our inference',
  M: 'model assumption',
  V: 'to verify',
};

interface SourcedProps {
  k: string;
  /** Appends "~" and a dotted underline. */
  modeled?: boolean;
  /** Sets a sentence in the surrounding font instead of the number font. */
  text?: boolean;
  children: ComponentChildren;
}

export function Sourced({ k, modeled, text, children }: SourcedProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const cls = ['sourced', modeled && 'modeled', text && 'text'].filter(Boolean).join(' ');
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return (
    <>
      <button ref={button} type="button" class={cls} data-source={k} onClick={() => setOpen(true)}>
        {children}
        {modeled ? '~' : null}
      </button>
      {open && createPortal(<SourcePopover k={k} onClose={close} />, document.body)}
    </>
  );
}

export function SourcePopover({ k, onClose }: { k: string; onClose: () => void }) {
  const source = getSource(k);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="scrim" onClick={onClose}>
      <div
        class="window popover"
        role="dialog"
        aria-label={source?.label ?? k}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="titlebar">
          <span>{source?.label ?? k}</span>
          <button ref={closeButton} type="button" class="close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div class="window-body">{source ? <SourceBody source={source} /> : <p>No source yet for “{k}”.</p>}</div>
      </div>
    </div>
  );
}

function SourceBody({ source }: { source: Source }) {
  return (
    <>
      <p class="tag">
        [{source.tag}] {TAG_NAMES[source.tag]}
      </p>
      <p>{source.explain}</p>
      {source.hidden && <p class="hidden-card">Hidden until year {source.hidden.revealAfterYears}.</p>}
      {source.links.length > 0 && (
        <ul class="links">
          {source.links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
