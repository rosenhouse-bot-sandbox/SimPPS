import { SCHOOLS } from '../data';
import type { Policy } from '../sim/types';
import { listEdits } from './edits';
import { Window } from './Window';

const A_TO_Z = [...SCHOOLS].sort((a, b) => a.name.localeCompare(b.name));

interface PlanProps {
  draft: Policy;
  base: Policy;
  onSelectSchool: (id: string) => void;
  onClose: () => void;
}

/** This year's edits, and the A–Z menu path to every school. */
export function PlanPanel({ draft, base, onSelectSchool, onClose }: PlanProps) {
  const edits = listEdits(draft, base);
  return (
    <Window title="Plan" onClose={onClose} class="panel">
      <h3>Edits</h3>
      {edits.length ? (
        <ul>
          {edits.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <p class="note">None yet.</p>
      )}
      <h3>Schools A–Z</h3>
      <ul class="az">
        {A_TO_Z.map((s) => (
          <li key={s.id}>
            <button type="button" class="row link" onClick={() => onSelectSchool(s.id)}>
              {s.name}
            </button>
          </li>
        ))}
      </ul>
    </Window>
  );
}
