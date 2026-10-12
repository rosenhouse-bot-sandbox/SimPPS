import { SCHOOLS } from '../data';
import { SCENARIOS, type BallotPreview, type Start } from '../sim';
import type { Policy } from '../sim/types';
import { BallotItem } from './Ballot';
import type { CalendarItem } from './calendar';
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
  /** Opens Zone mode. */
  onEditBoundary?: () => void;
  calendar: CalendarItem[];
  ballot: BallotPreview | null;
  year: number;
  onNewGame?: () => void;
  onClose: () => void;
}

/** What's coming, this year's edits with Undo, the ballot and the A–Z menu path to every school. */
export function PlanPanel({ draft, base, start, onEdit, onSelectSchool, onEditBoundary, calendar, ballot, year, onNewGame, onClose }: PlanProps) {
  const edits = listEdits(draft, base);
  const notModeled = SCENARIOS[start].notModeled;
  return (
    <Window title="Plan" onClose={onClose} class="panel">
      {notModeled && <ScenarioBadge start={start} />}
      <ul class="calendar" aria-label="Calendar">
        {calendar.map((i) => (
          <li key={i.text}>
            <span class="num when">{i.when}</span>
            <Sourced k={i.sourceKey} text>
              {i.text}
            </Sourced>
          </li>
        ))}
      </ul>
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
      {onEditBoundary && (
        <button type="button" class="btn wide" onClick={onEditBoundary}>
          Edit boundary
        </button>
      )}
      <h3>Ballot</h3>
      {ballot ? (
        <p class="ballot">
          <BallotItem ballot={ballot} year={year} />
        </p>
      ) : (
        <p class="note">None</p>
      )}
      {onNewGame && (
        <button type="button" class="btn wide" onClick={onNewGame}>
          New game
        </button>
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
