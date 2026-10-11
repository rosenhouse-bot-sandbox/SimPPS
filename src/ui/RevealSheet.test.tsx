import { cleanup, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { RevealSheet } from './RevealSheet';

afterEach(cleanup);

describe('RevealSheet', () => {
  it("draws the card's possible values as an accessible bar chart and marks this game's", () => {
    render(<RevealSheet reveal={{ sourceKey: 'model.followRate', value: 0.8 }} />);
    const sheet = screen.getByRole('region', { name: 'Revealed: Follow a closed school' });
    const chart = within(sheet).getByRole('img');
    expect(chart.getAttribute('aria-label')).toBe('Possible values: 95%, 88%, 80% and 65%, each 25% likely. This game drew 80%.');
    const bars = [...chart.querySelectorAll('[data-outcome]')];
    expect(bars.map((b) => b.getAttribute('data-outcome'))).toEqual(['95%', '88%', '80%', '65%']);
    expect(bars.map((b) => b.hasAttribute('data-drawn'))).toEqual([false, false, true, false]);
    expect(chart.textContent).toContain('This game');
    expect(sheet.textContent).toContain('This game drew 80%.');
  });

  it('lists the outcomes as a table and links the studies', () => {
    render(<RevealSheet reveal={{ sourceKey: 'model.followRate', value: 0.65 }} />);
    const rows = [...document.querySelectorAll('table tbody tr')].map((r) => r.textContent);
    expect(rows).toEqual(['95%25%', '88%25%', '80%25%', '65%25%This game']);
    expect(document.body.textContent).toContain('>93% stayed');
    const links = [...document.querySelectorAll('a')].map((a) => a.textContent);
    expect(links.some((t) => /Fiscal Consequences of School Closures/.test(t!))).toBe(true);
    expect(links.some((t) => /Rightsizing/.test(t!))).toBe(true);
  });

  it('scales bars by weight', () => {
    render(<RevealSheet reveal={{ sourceKey: 'model.closedZoneCapture', value: 0.02 }} />);
    const heights = [...document.querySelectorAll('[data-outcome] rect')].map((r) => Number(r.getAttribute('height')));
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBeGreaterThan(0);
  });
});
