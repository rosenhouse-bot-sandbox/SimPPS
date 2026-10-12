import { useState } from 'preact/hooks';
import { fmtRange } from '../format';
import { modeledRange, type ConversionChip } from '../sim';
import type { GradeSpanChange, SchoolId } from '../sim/types';
import { NEARBY, nameOf, type Candidate } from './closeSend';
import { Pick, Seats } from './CloseSendSheet';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

interface SendGradesProps {
  school: SchoolId;
  /** Middle schools that can take grades 6-8, nearest first. */
  candidates: Candidate[];
  to: SchoolId | null;
  chip: ConversionChip | null;
  onPick: (to: SchoolId) => void;
  onCommit: (change: GradeSpanChange) => void;
  onClose: () => void;
}

/** A K-8 sends grades 6-8 to one middle school and becomes K-5. */
export function SendGradesSheet({ school, candidates, to, chip, onPick, onCommit, onClose }: SendGradesProps) {
  const [az, setAz] = useState(false);
  const shown = az ? [...candidates].sort((a, b) => a.name.localeCompare(b.name)) : candidates.slice(0, NEARBY);
  const extra = shown.some((c) => c.id === to) ? [] : candidates.filter((c) => c.id === to);
  return (
    <Window title={`Send ${nameOf(school)} 6–8`} onClose={onClose} class="panel sheet closesend">
      <h3 class="step-head">Send grades 6–8 to</h3>
      <p class="note">Pick a middle school. Tap the map too.</p>
      {chip && (
        <div class="chip closure-chip" data-testid="conversion-chip">
          <dl>
            <div>
              <dt>Seats</dt>
              <dd class="num">
                <Seats {...chip.seats} />
              </dd>
            </div>
          </dl>
          <p class="pays">
            <Sourced k={K.gradeSpan}>{fmtRange(modeledRange(chip.kidsMoving))}</Sourced> 6th and 7th graders must choose.
          </p>
        </div>
      )}
      <ul class="picks">
        {[...extra, ...shown].map((c) => (
          <Pick key={c.id} c={c} picked={c.id === to} onToggle={() => onPick(c.id)} />
        ))}
      </ul>
      <button type="button" class="row link" aria-expanded={az} onClick={() => setAz(!az)}>
        {az ? 'Nearest only' : 'All schools A–Z'}
      </button>
      <div class="actions">
        <button type="button" class="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" class="btn primary" disabled={!to} onClick={() => to && onCommit({ school, to })}>
          Send 6–8
        </button>
      </div>
    </Window>
  );
}
