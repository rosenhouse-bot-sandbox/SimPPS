import { createPortal } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { GLOSSARY, isTerm, type GlossaryTerm, type PlainLabel } from './glossary';
import { Popover } from './Sourced';

interface TermProps {
  t: GlossaryTerm;
  /** Other wording of the term, such as a short form. */
  children?: string;
  /** Shows only the "?" mark, beside a label that already names the term. */
  icon?: boolean;
}

/** A label that opens its plain-language definition. */
export function Term({ t, children, icon }: TermProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const shown = icon ? '' : (children ?? t);
  const name = shown && shown !== t ? `${shown}, what is ${t}?` : `What is ${t}?`;
  return (
    <>
      <button
        ref={button}
        type="button"
        class={icon ? 'term icon' : 'term'}
        data-term={t}
        aria-label={name}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {shown}
      </button>
      {open &&
        createPortal(
          <Popover title={t} onClose={close}>
            <p class="definition">{GLOSSARY[t]}</p>
          </Popover>,
          document.body,
        )}
    </>
  );
}

/** A label that opens its definition, unless it needs none. */
export function Label({ t }: { t: GlossaryTerm | PlainLabel }) {
  return isTerm(t) ? <Term t={t} /> : <>{t}</>;
}

/** Text ending in a "?" mark that never wraps onto a line of its own. */
export function WithMark({ text, t }: { text: string; t: GlossaryTerm }) {
  const at = text.lastIndexOf(' ') + 1;
  return (
    <>
      {text.slice(0, at)}
      <span class="nowrap">
        {text.slice(at)}
        <Term t={t} icon />
      </span>
    </>
  );
}
