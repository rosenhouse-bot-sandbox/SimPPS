import { cleanup, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary';
import { FIXTURE_GAME } from './fixtures';
import { SchoolSheet } from './SchoolSheet';
import { termsIn } from './terms.testing';
import { TopBar } from './TopBar';

afterEach(cleanup);

describe('glossary', () => {
  it.each(Object.entries(GLOSSARY))('defines %s in at most three sentences', (_, text) => {
    expect(text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(3);
    expect(text).toMatch(/[.!?]$/);
  });

  it('defines every school sheet label but the year built', () => {
    render(<SchoolSheet id="rosa-parks" state={FIXTURE_GAME.schools['rosa-parks']} onClose={() => {}} />);
    const labels = [...document.querySelectorAll('dt, h3')].filter((l) => l.textContent !== 'Built');
    expect(labels.length).toBeGreaterThan(10);
    for (const label of labels) expect(termsIn(label), label.textContent!).toHaveLength(1);
    expect(termsIn()).toEqual([
      'Enrolled 25-26',
      'Capacity',
      'Utilization',
      'URM',
      'Retrofit left',
      'Direct cert.',
      'DLI',
      'Simulated',
      'Enrollment',
      'Homerooms',
      'Blended',
    ]);
  });

  it('makes each phone dial one button that defines it and sources its value', () => {
    render(<TopBar when="JAN 2027" dials={FIXTURE_GAME.dials} />);
    const dials = [...document.querySelectorAll('.topbar .dial')];
    expect(dials.map((d) => d.textContent)).toEqual(['Gap −$65.2M', 'Kids 26.4K', 'Cap 76.6%', 'Res 4.8%', 'Trust 35']);
    expect(termsIn()).toEqual([]);
    expect(dials.map((d) => d.getAttribute('data-term'))).toEqual(['Gap', 'Kids', 'Capture', 'Reserves', 'Trust']);
    for (const d of dials) expect(d.matches('button.sourced')).toBe(true);
  });

  it('spells out the desktop dials and defines each label', () => {
    render(<TopBar when="JAN 2027" dials={FIXTURE_GAME.dials} wide />);
    const text = document.querySelector('.topbar')!.textContent!;
    expect(text).toContain('Capture 76.6%');
    expect(text).toContain('Reserves 4.8%');
    expect(termsIn()).toEqual(['Gap', 'Kids', 'Capture', 'Reserves', 'Trust']);
    for (const d of document.querySelectorAll('.topbar .dial')) {
      expect(d.querySelector('.sourced')!.getAttribute('data-term')).toBe(d.querySelector('.term')!.getAttribute('data-term'));
    }
  });
});
