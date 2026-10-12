import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    expect(factValue('Enrollment').textContent).toBe('150–170~');
    expect(factValue('Homerooms').textContent).toBe('5–9~');
    expect(factValue('Blended').textContent).toBe('0–2~');
    fireEvent.click(screen.getByRole('button', { name: '150–170~' }));
    expect(screen.getByRole('dialog', { name: 'Simulated school counts' })).toBeTruthy();
  });

  it('offers Close & send for an open school while planning', () => {
    const onCloseSend = vi.fn();
    render(<SchoolSheet id="peninsula" state={FIXTURE_GAME.schools['peninsula']} onClose={() => {}} onCloseSend={onCloseSend} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close & send' }));
    expect(onCloseSend).toHaveBeenCalledOnce();
  });

  it('names the planned closure and offers to change it', () => {
    const closing = { school: 'peninsula', receivers: [{ school: 'rosa-parks', share: 1 }], building: 'mothball' as const };
    render(
      <SchoolSheet id="peninsula" state={FIXTURE_GAME.schools['peninsula']} onClose={() => {}} onCloseSend={() => {}} closing={closing} />,
    );
    expect(screen.getByText(/In the plan/).textContent).toBe('In the plan: Close Peninsula → Rosa Parks');
    expect(screen.getByRole('button', { name: 'Close Peninsula → Rosa Parks' }).getAttribute('data-source')).toBe('model.closureSavings');
    expect(screen.getByRole('button', { name: 'Change closure' })).toBeTruthy();
  });

  it('names the closures the plan sends into it', () => {
    render(<SchoolSheet id="rosa-parks" state={FIXTURE_GAME.schools['rosa-parks']} onClose={() => {}} receivesFrom={['peninsula', 'james-john']} />);
    expect(screen.getByText(/takes kids/).textContent).toBe(
      'In the plan: takes kids from Peninsula and James John. Change that closure to close this school.',
    );
  });

  it('says when a school closed and shows no simulated counts', () => {
    const state = { ...FIXTURE_GAME.schools['peninsula'], open: false, enrollment: 0, closed: { year: 2027, building: 'sell' as const } };
    render(<SchoolSheet id="peninsula" state={state} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Closed in 2027, sold.' }).getAttribute('data-source')).toBe('model.buildingFate');
    expect(screen.queryByText('Simulated')).toBeNull();
    expect(screen.queryByText('Enrollment')).toBeNull();
  });

  it('offers Send 6–8 for a K-8 while planning and names the planned change', () => {
    const onSendGrades = vi.fn();
    const converting = { school: 'vernon', to: 'harriet-tubman' };
    render(<SchoolSheet id="vernon" state={FIXTURE_GAME.schools.vernon} onClose={() => {}} onSendGrades={onSendGrades} converting={converting} />);
    expect(screen.getByRole('button', { name: 'Send Vernon 6–8 → Harriet Tubman' }).getAttribute('data-source')).toBe('model.gradeSpan');
    fireEvent.click(screen.getByRole('button', { name: 'Send 6–8 to…' }));
    expect(onSendGrades).toHaveBeenCalledOnce();
  });

  it('names the K-8s the plan sends grades 6-8 into it', () => {
    render(<SchoolSheet id="harriet-tubman" state={FIXTURE_GAME.schools['harriet-tubman']} onClose={() => {}} gradesFrom={['vernon']} />);
    expect(screen.getByText(/takes grades/).textContent).toBe('In the plan: takes grades 6–8 from Vernon. Undo that to close this school.');
  });

  it('says when a K-8 became K-5 and shows its seats', () => {
    const state = { ...FIXTURE_GAME.schools.vernon, capacity: 564.2, converted: { year: 2027, to: 'harriet-tubman' } };
    render(<SchoolSheet id="vernon" state={state} onClose={() => {}} />);
    expect(factValue('K-5 seats').textContent).toBe('564');
    expect(factValue('Capacity as K-8').textContent).toBe('579');
    expect(screen.getByRole('button', { name: '564' }).getAttribute('data-source')).toBe('model.gradeSpan');
    expect(screen.getByRole('button', { name: 'K-5 since 2027. Grades 6–8 go to Harriet Tubman.' }).getAttribute('data-source')).toBe(
      'model.gradeSpan',
    );
  });

  it('drops the receiver once it closes, and the K-5 line once the school closes', () => {
    const state = { ...FIXTURE_GAME.schools.vernon, converted: { year: 2027, to: 'harriet-tubman' } };
    render(<SchoolSheet id="vernon" state={state} onClose={() => {}} receiverOpen={false} />);
    expect(screen.getByRole('button', { name: 'K-5 since 2027.' })).toBeTruthy();
    cleanup();
    render(<SchoolSheet id="vernon" state={{ ...state, open: false, closed: { year: 2028, building: 'mothball' } }} onClose={() => {}} />);
    expect(screen.queryByText(/K-5 since/)).toBeNull();
  });

  it('offers Edit boundary while planning', () => {
    const onEditBoundary = vi.fn();
    render(<SchoolSheet id="rosa-parks" state={FIXTURE_GAME.schools['rosa-parks']} onClose={() => {}} onEditBoundary={onEditBoundary} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit boundary' }));
    expect(onEditBoundary).toHaveBeenCalled();
    cleanup();
    render(<SchoolSheet id="rosa-parks" state={FIXTURE_GAME.schools['rosa-parks']} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Edit boundary' })).toBeNull();
  });
});
