import { fmtMoney, fmtPct } from '../format';
import { M } from '../sim/model';
import type { BallotPreview } from '../sim';
import type { Budget, ElectionMonth, GameState, Policy } from '../sim/types';
import { BallotItem } from './Ballot';
import { Chip } from './Chip';
import { fmtLevy } from './edits';
import { CLASS_SIZE, classSizeChip, LEVY, levyChip, RESERVE_STEP, reserveChip } from './levers';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Stepper } from './Stepper';
import { Term } from './Term';
import { Window } from './Window';

interface BudgetPanelProps {
  game: GameState;
  draft: Policy;
  /** The sim's plan for the draft. */
  plan: Budget;
  /** The levy measure the draft puts to voters. */
  ballot: BallotPreview | null;
  /** The fall year of the levy's last funded school year. */
  levyThrough: number;
  onEdit: (p: Partial<Policy>) => void;
  onClose: () => void;
}

const MONTHS: { id: ElectionMonth; label: string }[] = [
  { id: 'may', label: 'May' },
  { id: 'november', label: 'November' },
];

/** In January of `year`: the levy's last June has passed once `through + 1 < year`. */
function levyTermText(through: number, year: number, rate: number): string {
  if (through + 1 < year) return `Levy expired June ${through + 1}`;
  if (rate === 0) return `Levy lapses after June ${year}`;
  return `Levy ${through + 1 === year ? 'expires' : 'runs through'} June ${through + 1}`;
}

export function BudgetPanel({ game, draft, plan, ballot, levyThrough, onEdit, onClose }: BudgetPanelProps) {
  const base = game.policy;
  const bill = -(plan.lines.find((l) => l.key === 'election')?.amount ?? 0);
  const renewable = levyThrough === game.year && draft.levyRate > 0;
  const drawMax = Math.min(plan.reserves, Math.max(0, -plan.gap));
  return (
    <Window title="Budget" onClose={onClose} class="panel">
      <Stepper
        label="K-5 class size"
        labelNode={<Term t="K-5 class size" />}
        sourceKey={K.classSize}
        term="K-5 class size"
        value={draft.k5ClassSize}
        {...CLASS_SIZE}
        format={String}
        onChange={(k5ClassSize) => onEdit({ k5ClassSize })}
      />
      {draft.k5ClassSize !== base.k5ClassSize && (
        <Chip chip={classSizeChip(draft.k5ClassSize, base.k5ClassSize)} sourceKey={K.classSize} />
      )}
      <Stepper
        label="Levy rate"
        labelNode={<Term t="Levy">Levy per $1K</Term>}
        sourceKey={K.levy}
        term="Levy"
        value={draft.levyRate}
        {...LEVY}
        anchor={base.levyRate || M.levyRate}
        format={fmtLevy}
        onChange={(levyRate) => onEdit({ levyRate })}
      />
      {draft.levyRate !== base.levyRate && <Chip chip={levyChip(draft.levyRate, base.levyRate, bill, ballot?.when)} sourceKey={K.levyRate} />}
      {bill > 0 && (
        <p class="note">
          <Term t="Election bill" />: <Sourced k={K.electionBill} term="Election bill">{fmtMoney(-bill)}</Sourced>
        </p>
      )}
      <p class="note">
        <Sourced k={K.levyTerm} text>
          {levyTermText(levyThrough, game.year, draft.levyRate)}
        </Sourced>
      </p>
      {(ballot || renewable) && (
        <fieldset class="levy-ballot">
          <legend>
            <Term t="Levy ballot" />
          </legend>
          {MONTHS.map((m) => (
            <label key={m.id} class="row choice">
              <input
                type="radio"
                name="levy-ballot"
                checked={draft.levyElection === m.id}
                onChange={() => onEdit({ levyElection: m.id })}
              />
              {m.label}
            </label>
          ))}
          <p class="ballot">{ballot ? <BallotItem ballot={ballot} year={game.year} /> : 'No vote this year.'}</p>
        </fieldset>
      )}
      <Stepper
        label="Reserve draw"
        labelNode={<Term t="Reserve draw" />}
        sourceKey={K.reserveDraw}
        term="Reserve draw"
        value={plan.reserveDraw}
        min={0}
        max={drawMax}
        step={RESERVE_STEP}
        format={fmtMoney}
        onChange={(reserveDraw) => onEdit({ reserveDraw })}
      />
      {plan.reserveDraw > 0 && (
        <>
          <Chip chip={reserveChip(plan.reserveDraw)} sourceKey={K.reserveDraw} />
          <p class="note">
            <Term t="Reserves">Reserves after</Term>:{' '}
            <Sourced k={K.reservePct} term="Reserves">{`${fmtMoney(plan.reservesAfter)}, ${fmtPct(plan.reservePctAfterDraw)}`}</Sourced>
          </p>
          {plan.reservePctAfterDraw < 0.05 && (
            <p class="note warn">
              <Sourced k={K.reservePct} text>
                Below 5% breaches policy.
              </Sourced>
            </p>
          )}
          {plan.midYearCuts > 0 && (
            <p class="note warn">
              <Sourced k={K.midYearCuts} text>{`Below 3%: ${plan.midYearCuts.toLocaleString('en-US')} positions cut mid-year.`}</Sourced>
            </p>
          )}
        </>
      )}
    </Window>
  );
}
