import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary';
import { FIXTURE_GAME } from './fixtures';
import { SchoolSheet } from './SchoolSheet';
import { TopBar } from './TopBar';

afterEach(cleanup);

function termsIn(el: Element): string[] {
  return [...el.querySelectorAll('.term')].map((t) => t.getAttribute('data-term')!);
}

describe('glossary', () => {
  it.each(Object.entries(GLOSSARY))('defines %s in one or two sentences', (_, text) => {
    expect(text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
    expect(text).toMatch(/[.!?]$/);
  });

  it('defines every school sheet label', () => {
    render(<SchoolSheet id="rosa-parks" state={FIXTURE_GAME.schools['rosa-parks']} onClose={() => {}} />);
    const labels = [...document.querySelectorAll('dt, h3')];
    expect(labels.length).toBeGreaterThan(10);
    for (const label of labels) {
      const terms = termsIn(label);
      expect(terms, label.textContent!).toHaveLength(1);
      expect(GLOSSARY).toHaveProperty([terms[0]]);
    }
  });

  it('defines every top bar dial and its value', () => {
    render(<TopBar when="JAN 2027" dials={FIXTURE_GAME.dials} />);
    const dials = [...document.querySelectorAll('.topbar .dial')];
    expect(dials.map(termsIn)).toEqual([['Gap'], ['Kids'], ['Capture'], ['Reserves'], ['Trust']]);
    for (const dial of dials) expect(dial.querySelector('.sourced')!.getAttribute('data-term')).toBe(termsIn(dial)[0]);
  });

  it('spells out the top bar on a desktop', () => {
    render(<TopBar when="JAN 2027" dials={FIXTURE_GAME.dials} wide />);
    const wide = document.querySelector('.topbar')!.textContent!;
    expect(wide).toContain('Capture 76.6%');
    expect(wide).toContain('Reserves 4.8%');
    cleanup();
    render(<TopBar when="JAN 2027" dials={FIXTURE_GAME.dials} />);
    expect(document.querySelector('.topbar')!.textContent).toContain('Cap 76.6%');
  });
});
