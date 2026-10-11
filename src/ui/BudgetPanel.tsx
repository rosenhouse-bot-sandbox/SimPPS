import { fmtMoney, fmtPct } from '../format';
import type { Budget, GameState, Policy } from '../sim/types';
import { Chip } from './Chip';
import { fmtLevy } from './edits';
import { CLASS_SIZE, classSizeChip, LEVY, levyChip, RESERVE_STEP, reserveChip } from './levers';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Stepper } from './Stepper';
import { Window } from './Window';

interface BudgetPanelProps {
  game: GameState;
  draft: Policy;
  /** The sim's plan for the draft. */
  plan: Budget;
  onEdit: (p: Partial<Policy>) => void;
  onClose: () => void;
}

export function BudgetPanel({ game, draft, plan, onEdit, onClose }: BudgetPanelProps) {
  const base = game.policy;
  const drawMax = Math.min(plan.reserves, Math.max(0, -plan.gap));
  return (
    <Window title="Budget" onClose={onClose} class="panel">
      <Stepper
        label="K-5 class size"
        labelNode={<Sourced k={K.classSize}>K-5 class size</Sourced>}
        sourceKey={K.classSize}
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
        labelNode={<Sourced k={K.levy}>Levy per $1K</Sourced>}
        sourceKey={K.levy}
        value={draft.levyRate}
        {...LEVY}
        anchor={base.levyRate}
        format={fmtLevy}
        onChange={(levyRate) => onEdit({ levyRate })}
      />
      {draft.levyRate !== base.levyRate && <Chip chip={levyChip(draft.levyRate, base.levyRate)} sourceKey={K.levy} />}
      <Stepper
        label="Reserve draw"
        labelNode={<Sourced k={K.reserveDraw}>Reserve draw</Sourced>}
        sourceKey={K.reserveDraw}
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
            Reserves after:{' '}
            <Sourced k={K.reservePct}>{`${fmtMoney(plan.reservesAfter)}, ${fmtPct(plan.reservePctAfterDraw)}`}</Sourced>
          </p>
          {plan.reservePctAfterDraw < 0.05 && (
            <p class="note warn">
              <Sourced k={K.reservePct}>Below 5% breaches policy.</Sourced>
            </p>
          )}
          {plan.midYearCuts > 0 && (
            <p class="note warn">
              <Sourced k={K.midYearCuts}>{`Below 3%: ${plan.midYearCuts.toLocaleString('en-US')} positions cut mid-year.`}</Sourced>
            </p>
          )}
        </>
      )}
    </Window>
  );
}
