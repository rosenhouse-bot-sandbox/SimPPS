import { expect } from 'vitest';
import { GLOSSARY } from './glossary';

/** The glossary labels in `el`, in order. Fails on a label with no definition. */
export function termsIn(el: Element = document.body): string[] {
  const terms = [...el.querySelectorAll('.term')].map((t) => t.getAttribute('data-term')!);
  for (const t of terms) expect(GLOSSARY, t).toHaveProperty([t]);
  return terms;
}
