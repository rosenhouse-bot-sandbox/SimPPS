import { fmtMoney } from '../format';
import type { Policy } from '../sim/types';
import { K } from './sources';

export interface EditLine {
  text: string;
  sourceKey: string;
}

export function fmtLevy(rate: number): string {
  return rate === 0 ? 'lapse' : `$${rate.toFixed(2)}`;
}

/** Plain lines naming each change from the policy in force. */
export function listEdits(draft: Policy, base: Policy): EditLine[] {
  const out: EditLine[] = [];
  if (draft.k5ClassSize !== base.k5ClassSize)
    out.push({ text: `K-5 class size ${base.k5ClassSize} → ${draft.k5ClassSize}`, sourceKey: K.classSize });
  if (draft.levyRate !== base.levyRate)
    out.push({ text: `Levy ${fmtLevy(base.levyRate)} → ${fmtLevy(draft.levyRate)}`, sourceKey: K.levy });
  if (draft.reserveDraw > 0) out.push({ text: `Draw ${fmtMoney(draft.reserveDraw)} from reserves`, sourceKey: K.reserveDraw });
  return out;
}

/** A new levy rate goes to voters in May. Until elections exist, it passes. A lapse needs no vote. */
export function ballotItems(draft: Policy, base: Policy): EditLine[] {
  if (draft.levyRate === base.levyRate || draft.levyRate === 0) return [];
  return [{ text: `May: levy at ${fmtLevy(draft.levyRate)} per $1,000, assumed to pass`, sourceKey: K.levy }];
}
