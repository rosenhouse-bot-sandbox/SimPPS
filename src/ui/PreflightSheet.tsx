import { fmtCount, fmtMoney } from '../format';
import { legislatureVotes } from '../sim/budget';
import type { BallotPreview } from '../sim';
import type { Budget, Policy, ProgramMove } from '../sim/types';
import { BallotItem } from './Ballot';
import { nameOf } from './closeSend';
import { listEdits, type EditLine } from './edits';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Term } from './Term';
import { Window } from './Window';

interface PreflightProps {
  year: number;
  draft: Policy;
  base: Policy;
  /** The sim's plan for the draft. */
  budget: Budget;
  ballot: BallotPreview | null;
  /** The DLI programs the plan's closures carry. */
  closurePrograms?: ProgramMove[];
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

export function PreflightSheet({ year, draft, base, budget, ballot, closurePrograms = [], onBack, onConfirm }: PreflightProps) {
  const applied = { ...draft, reserveDraw: budget.reserveDraw };
  const { autoCutPositions: june, midYearCuts: winter } = budget;
  return (
    <div class="scrim">
      <Window title={`Play ${year}-${String(year + 1).slice(2)}?`} class="panel sheet" onClose={onBack} dialog>
        <h3>Edits</h3>
        <List
          items={[
            ...listEdits(applied, base),
            ...closurePrograms.map((m) => ({ text: `${m.program} DLI moves to ${nameOf(m.to)}`, sourceKey: K.programMove })),
          ]}
          empty="None. The year plays as it stands."
        />
        <h3>
          <Term t="Gap" />
        </h3>
        <p>
          <Sourced k={K.gap} term="Gap">{fmtMoney(budget.gap)}</Sourced>
          {budget.reserveDraw > 0 && (
            <>
              . Reserves cover <Sourced k={K.reserveDraw} term="Reserve draw">{fmtMoney(budget.reserveDraw)}</Sourced>.
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
        <h3>
          <Term t="Automatic cuts" />
        </h3>
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
        {ballot ? (
          <>
            <p class="ballot">
              <BallotItem ballot={ballot} year={year} />
            </p>
            {ballot.when === 'may' && <p class="note">The plan books it as passing.</p>}
          </>
        ) : (
          <p class="note">None</p>
        )}
        <div class="actions">
          <button type="button" class="btn" onClick={onBack}>
            Back
          </button>
          <button type="button" class="btn primary" onClick={onConfirm}>
            Play
          </button>
        </div>
      </Window>
    </div>
  );
}
