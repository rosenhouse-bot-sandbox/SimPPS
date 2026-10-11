import type { Policy, Range } from '../sim/types';
import { ballotItems, listEdits } from './edits';
import { fmtGap } from './GapBar';
import { HoldButton } from './HoldButton';
import { autoCutPositions, midpoint } from './levers';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

interface PreflightProps {
  year: number;
  draft: Policy;
  base: Policy;
  gap: Range;
  onBack: () => void;
  onConfirm: () => void;
}

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? (
    <ul>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  ) : (
    <p class="note">{empty}</p>
  );
}

export function PreflightSheet({ year, draft, base, gap, onBack, onConfirm }: PreflightProps) {
  const cuts = autoCutPositions(midpoint(gap));
  return (
    <div class="scrim">
      <Window title={`Play ${year}-${String(year + 1).slice(2)}?`} class="panel sheet" onClose={onBack}>
        <h3>Edits</h3>
        <List items={listEdits(draft, base)} empty="None. The year plays as it stands." />
        <h3>Gap</h3>
        <p>
          <Sourced k={K.gap}>{fmtGap(gap)}</Sourced>
        </p>
        <h3>Automatic cuts</h3>
        <p>
          {cuts > 0 ? (
            <>
              <Sourced k={K.autoCuts} modeled>
                {cuts}
              </Sourced>{' '}
              positions in June
            </>
          ) : (
            'None'
          )}
        </p>
        <h3>Ballot</h3>
        <List items={ballotItems(draft, base)} empty="None" />
        <div class="actions">
          <button type="button" class="btn" onClick={onBack}>
            Back
          </button>
          <HoldButton class="btn primary" label="Play the year" onConfirm={onConfirm}>
            Hold to play
          </HoldButton>
        </div>
      </Window>
    </div>
  );
}
