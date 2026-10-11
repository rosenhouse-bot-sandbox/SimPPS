import { SCHOOLS } from '../data';
import { SCENARIOS, type Start } from '../sim';
import type { Policy } from '../sim/types';
import { listEdits } from './edits';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

const A_TO_Z = [...SCHOOLS].sort((a, b) => a.name.localeCompare(b.name));

interface PlanProps {
  draft: Policy;
  base: Policy;
  start: Start;
  onEdit: (p: Partial<Policy>) => void;
  onSelectSchool: (id: string) => void;
  onClose: () => void;
}

/** This year's edits with Undo, and the A–Z menu path to every school. */
export function PlanPanel({ draft, base, start, onEdit, onSelectSchool, onClose }: PlanProps) {
  const edits = listEdits(draft, base);
  const notModeled = SCENARIOS[start].notModeled;
  return (
    <Window title="Plan" onClose={onClose} class="panel">
      {notModeled && <ScenarioBadge start={start} />}
      <h3>Edits</h3>
      {edits.length ? (
        <ul class="edits">
          {edits.map((e) => (
            <li key={e.text} class="row">
              <Sourced k={e.sourceKey} text>
                {e.text}
              </Sourced>
              {e.undo && (
                <button type="button" class="btn undo" aria-label={`Undo ${e.text}`} onClick={() => onEdit(e.undo!)}>
                  Undo
                </button>
              )}
            </li>
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

export function ScenarioBadge({ start }: { start: Start }) {
  const s = SCENARIOS[start];
  if (!s.notModeled) return null;
  return (
    <p class="badge">
      <Sourced k={K.scenarios} text>
        {s.notModeled}
      </Sourced>
    </p>
  );
}
