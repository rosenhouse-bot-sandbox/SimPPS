import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCHOOLS } from '../data';
import { fixtureSchools } from './fixtures';
import { SchoolList } from './SchoolList';

afterEach(cleanup);

describe('SchoolList', () => {
  it('lists every school A–Z under letter headings, ignoring case and accents', () => {
    render(<SchoolList selected={null} onSelectSchool={() => {}} />);
    const names = screen.getAllByRole('button').map((b) => b.firstChild!.textContent);
    expect(names).toHaveLength(SCHOOLS.length);
    expect(names[0]).toBe('Abernethy Elementary School');
    expect(names.indexOf('César Chávez K-8 School')).toBeLessThan(names.indexOf('Chapman Elementary School'));
    expect(names.indexOf('da Vinci Middle School')).toBeGreaterThan(names.indexOf('Clark Elementary School'));
    expect(screen.getByRole('region', { name: 'D' }).textContent).toContain('da Vinci');
  });

  it('filters by a typed name and selects on tap', () => {
    const onSelect = vi.fn();
    render(<SchoolList selected={null} onSelectSchool={onSelect} />);
    fireEvent.input(screen.getByLabelText('Find a school'), { target: { value: 'chavez' } });
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith('cesar-chavez');
  });

  it('marks the selected school and closed schools', () => {
    const schools = fixtureSchools();
    schools['rosa-parks'] = { ...schools['rosa-parks'], open: false };
    render(<SchoolList schools={schools} selected="whitman" onSelectSchool={() => {}} />);
    expect(screen.getByRole('button', { pressed: true }).textContent).toContain('Whitman');
    expect(screen.getByRole('button', { name: /Rosa Parks/ }).textContent).toContain('closed');
  });
});
