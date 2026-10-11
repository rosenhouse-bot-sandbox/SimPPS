import type { Policy } from '../sim/types';
import { fmtMoney } from './format';

export function fmtLevy(rate: number): string {
  return rate === 0 ? 'lapse' : `$${rate.toFixed(2)}`;
}

/** Plain lines naming each change from the policy in force. */
export function listEdits(draft: Policy, base: Policy): string[] {
  const out: string[] = [];
  if (draft.k5ClassSize !== base.k5ClassSize) out.push(`K-5 class size ${base.k5ClassSize} → ${draft.k5ClassSize}`);
  if (draft.levyRate !== base.levyRate) out.push(`Levy ${fmtLevy(base.levyRate)} → ${fmtLevy(draft.levyRate)}`);
  if (draft.reserveDraw > 0) out.push(`Draw ${fmtMoney(draft.reserveDraw)} from reserves`);
  return out;
}

/** A new levy rate goes to voters in May. A lapse needs no vote. */
export function ballotItems(draft: Policy, base: Policy): string[] {
  if (draft.levyRate === base.levyRate || draft.levyRate === 0) return [];
  return [`May: levy at ${fmtLevy(draft.levyRate)} per $1,000`];
}
