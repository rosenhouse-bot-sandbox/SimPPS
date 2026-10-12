import { createContext, type ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { FIRST_YEAR } from '../sim';
import { getSource, type HiddenCard, type Source, type SourceTag } from '../sources/registry';
import './sources';
import { trapTab } from './Window';

export const TAG_NAMES: Record<SourceTag, string> = {
  F: 'public source',
  N: 'news',
  I: 'our inference',
  M: 'model assumption',
  V: 'to verify',
};

/** Hidden cards revealed so far: the value this game drew, by source key. */
export const Revealed = createContext<Record<string, number>>({});

/** The fall year whose December report reveals the card. */
export function revealYear(card: HiddenCard): number {
  return FIRST_YEAR + card.revealAfterYears - 1;
}

export function drawnLabel(card: HiddenCard, value: number): string {
  return card.outcomes.find((o) => o.value === value)?.label ?? String(value);
}

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
        {typeof children === 'string' && children.endsWith('~') ? withTilde(children.slice(0, -1)) : children}
        {modeled ? <span class="tilde">~</span> : null}
      </button>
      {open && createPortal(<SourcePopover k={k} onClose={close} />, document.body)}
    </>
  );
}

function withTilde(text: string) {
  return (
    <>
      {text}
      <span class="tilde">~</span>
    </>
  );
}

export function SourcePopover({ k, onClose }: { k: string; onClose: () => void }) {
  const source = getSource(k);
  const revealed = useContext(Revealed);
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
        aria-modal="true"
        aria-label={source?.label ?? k}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div class="titlebar">
          <span>{source?.label ?? k}</span>
          <button ref={closeButton} type="button" class="close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div class="window-body">{source ? <SourceBody source={source} drawn={revealed[source.key]} /> : <p>No source yet for “{k}”.</p>}</div>
      </div>
    </div>
  );
}

function SourceBody({ source, drawn }: { source: Source; drawn?: number }) {
  return (
    <>
      <p class="tag">
        [{source.tag}] {TAG_NAMES[source.tag]}
      </p>
      <p>{source.explain}</p>
      {source.hidden && (
        <p class="hidden-card">
          {drawn === undefined
            ? `Hidden until the December ${revealYear(source.hidden)} report.`
            : `Revealed: this game drew ${drawnLabel(source.hidden, drawn)}.`}
        </p>
      )}
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
