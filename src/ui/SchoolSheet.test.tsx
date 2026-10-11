import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { FIXTURE_GAME } from './fixtures';
import { SchoolSheet } from './SchoolSheet';

afterEach(cleanup);

function factValue(label: string): HTMLElement {
  return screen.getByText(label).closest('.fact')!.querySelector('dd')!;
}

describe('SchoolSheet', () => {
  it('shows sourced facts from pps-data', () => {
    render(<SchoolSheet id="rosa-parks" state={FIXTURE_GAME.schools['rosa-parks']} onClose={() => {}} />);
    expect(screen.getByRole('region', { name: 'Rosa Parks Elementary School' })).toBeTruthy();
    expect(factValue('Enrolled 25-26').textContent).toBe('160');
    expect(factValue('Capacity').textContent).toBe('594');
    expect(factValue('Utilization').textContent).toBe('26.9%');
    expect(factValue('Built').textContent).toBe('2006');
    expect(factValue('URM').textContent).toBe('No');
    expect(factValue('Direct cert.').textContent).toBe('62.9%');
    expect(factValue('DLI').textContent).toBe('None');
    fireEvent.click(screen.getByRole('button', { name: '2006' }));
    expect(screen.getByRole('dialog', { name: 'Year built' })).toBeTruthy();
  });

  it('shows simulated enrollment as a range', () => {
    render(<SchoolSheet id="rosa-parks" state={FIXTURE_GAME.schools['rosa-parks']} onClose={() => {}} />);
    expect(factValue('Enrollment').textContent).toBe('152–168~');
    expect(factValue('Homerooms').textContent).toBe('7~');
    fireEvent.click(screen.getByRole('button', { name: '152–168~' }));
    expect(screen.getByRole('dialog', { name: 'Simulated enrollment' })).toBeTruthy();
  });
});
