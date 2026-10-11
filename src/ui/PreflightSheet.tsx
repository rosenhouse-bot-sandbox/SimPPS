import { fmtCount, fmtMoney } from '../format';
import { legislatureVotes } from '../sim/budget';
import type { Budget, Policy } from '../sim/types';
import { ballotItems, listEdits, type EditLine } from './edits';
import { HoldButton } from './HoldButton';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

interface PreflightProps {
  year: number;
  draft: Policy;
  base: Policy;
  /** The sim's plan for the draft. */
  budget: Budget;
  onBack: () => void;
  onConfirm: () => void;
}

function List({ items, empty }: { items: EditLine[]; empty: string }) {
  return items.length ? (
    <ul>
      {items.map((t) => (
        <li key={t.text}>
          <Sourced k={t.sourceKey} text>
            {t.text}
          </Sourced>
        </li>
      ))}
    </ul>
  ) : (
    <p class="note">{empty}</p>
  );
}

export function PreflightSheet({ year, draft, base, budget, onBack, onConfirm }: PreflightProps) {
  const applied = { ...draft, reserveDraw: budget.reserveDraw };
  const { autoCutPositions: june, midYearCuts: winter } = budget;
  return (
    <div class="scrim">
      <Window title={`Play ${year}-${String(year + 1).slice(2)}?`} class="panel sheet" onClose={onBack}>
        <h3>Edits</h3>
        <List items={listEdits(applied, base)} empty="None. The year plays as it stands." />
        <h3>Gap</h3>
        <p>
          <Sourced k={K.gap}>{fmtMoney(budget.gap)}</Sourced>
          {budget.reserveDraw > 0 && (
            <>
              . Reserves cover <Sourced k={K.reserveDraw}>{fmtMoney(budget.reserveDraw)}</Sourced>.
            </>
          )}
        </p>
        {legislatureVotes(year) && (
          <p class="note">
            <Sourced k={K.stateFunding} text>
              At flat state funding. The Legislature votes this spring.
            </Sourced>
          </p>
        )}
        <h3>Automatic cuts</h3>
        {june + winter > 0 ? (
          <ul>
            {june > 0 && (
              <li>
                <Sourced k={K.autoCuts}>{fmtCount(june)}</Sourced> positions in June
              </li>
            )}
            {winter > 0 && (
              <li>
                <Sourced k={K.midYearCuts}>{fmtCount(winter)}</Sourced> more mid-year, as reserves fall below 3%
              </li>
            )}
          </ul>
        ) : (
          <p>None</p>
        )}
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
