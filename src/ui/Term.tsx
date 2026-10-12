import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useRef, useState } from 'preact/hooks';
import { define, type GlossaryTerm } from './glossary';
import { Popover } from './Sourced';

interface TermProps {
  t: GlossaryTerm;
  /** A short form or other wording of the term. */
  children?: ComponentChildren;
  /** Shows only the "?" mark, beside a label that already names the term. */
  icon?: boolean;
}

/** A label that opens its plain-language definition. */
export function Term({ t, children, icon }: TermProps) {
  const text = define(t);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return (
    <>
      <button ref={button} type="button" class={icon ? 'term icon' : 'term'} data-term={t} aria-label={`What is ${t}?`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {icon ? null : (children ?? t)}
      </button>
      {open &&
        createPortal(
          <Popover title={t} onClose={close}>
            <p class="definition">{text}</p>
          </Popover>,
          document.body,
        )}
    </>
  );
}
