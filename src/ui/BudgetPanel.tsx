import type { GameState, Policy } from '../sim/types';
import { Chip } from './Chip';
import { fmtLevy } from './edits';
import { fmtMoney, fmtPct } from '../format';
import { CLASS_SIZE, classSizeChip, LEVY, levyChip, RESERVE_STEP, reserveChip } from './levers';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Stepper } from './Stepper';
import { Window } from './Window';

interface BudgetPanelProps {
  game: GameState;
  draft: Policy;
  onEdit: (p: Partial<Policy>) => void;
  onClose: () => void;
}

export function BudgetPanel({ game, draft, onEdit, onClose }: BudgetPanelProps) {
  const base = game.policy;
  const { reserves, reservePct } = game.budget;
  const fund = reserves / reservePct;
  const reserveMax = Math.floor(reserves / RESERVE_STEP) * RESERVE_STEP;
  return (
    <Window title="Budget" onClose={onClose} class="panel">
      <Stepper
        label="K-5 class size"
        labelNode={<Sourced k={K.classSize}>K-5 class size</Sourced>}
        value={draft.k5ClassSize}
        {...CLASS_SIZE}
        format={String}
        onChange={(k5ClassSize) => onEdit({ k5ClassSize })}
      />
      {draft.k5ClassSize !== base.k5ClassSize && <Chip chip={classSizeChip(draft.k5ClassSize, base.k5ClassSize)} />}
      <Stepper
        label="Levy rate"
        labelNode={<Sourced k={K.levy}>Levy per $1K</Sourced>}
        value={draft.levyRate}
        {...LEVY}
        format={fmtLevy}
        onChange={(levyRate) => onEdit({ levyRate })}
      />
      {draft.levyRate !== base.levyRate && <Chip chip={levyChip(draft.levyRate, base.levyRate)} />}
      <Stepper
        label="Reserve draw"
        labelNode={<Sourced k={K.reserveDraw}>Reserve draw</Sourced>}
        value={draft.reserveDraw}
        min={0}
        max={reserveMax}
        step={RESERVE_STEP}
        format={fmtMoney}
        onChange={(reserveDraw) => onEdit({ reserveDraw })}
      />
      {draft.reserveDraw > 0 && (
        <>
          <Chip chip={reserveChip(draft.reserveDraw)} />
          <p class="note">
            Reserves after:{' '}
            <Sourced k={K.reservePct}>{fmtPct((reserves - draft.reserveDraw) / fund)}</Sourced>
          </p>
        </>
      )}
    </Window>
  );
}
