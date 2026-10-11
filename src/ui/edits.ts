import { fmtMoney } from '../format';
import type { Closure, Policy } from '../sim/types';
import { nameOf } from './closeSend';
import { K } from './sources';

export interface EditLine {
  text: string;
  sourceKey: string;
  /** The patch that takes this edit back out of the draft. */
  undo?: Partial<Policy>;
}

const FATE = { mothball: '', lease: ' · leased', sell: ' · sold' };

export function closureText(c: Closure): string {
  const to = c.receivers.map((r) => (c.receivers.length > 1 ? `${nameOf(r.school)} ${Math.round(r.share * 100)}%` : nameOf(r.school)));
  return `Close ${nameOf(c.school)} → ${to.join(', ')}${FATE[c.building]}`;
}

export function fmtLevy(rate: number): string {
  return rate === 0 ? 'lapse' : `$${rate.toFixed(2)}`;
}

/** Plain lines naming each change from the policy in force. Closures last one plan, so each is an edit. */
export function listEdits(draft: Policy, base: Policy): EditLine[] {
  const out: EditLine[] = draft.closures.map((c) => ({
    text: closureText(c),
    sourceKey: K.closureSavings,
    undo: { closures: draft.closures.filter((x) => x !== c) },
  }));
  if (draft.k5ClassSize !== base.k5ClassSize)
    out.push({
      text: `K-5 class size ${base.k5ClassSize} → ${draft.k5ClassSize}`,
      sourceKey: K.classSize,
      undo: { k5ClassSize: base.k5ClassSize },
    });
  if (draft.levyRate !== base.levyRate)
    out.push({ text: `Levy ${fmtLevy(base.levyRate)} → ${fmtLevy(draft.levyRate)}`, sourceKey: K.levy, undo: { levyRate: base.levyRate } });
  if (draft.reserveDraw > 0)
    out.push({ text: `Draw ${fmtMoney(draft.reserveDraw)} from reserves`, sourceKey: K.reserveDraw, undo: { reserveDraw: 0 } });
  return out;
}

/** A new levy rate goes to voters in May. Until elections exist, it passes. A lapse needs no vote. */
export function ballotItems(draft: Policy, base: Policy): EditLine[] {
  if (draft.levyRate === base.levyRate || draft.levyRate === 0) return [];
  return [{ text: `May: levy at ${fmtLevy(draft.levyRate)} per $1,000, assumed to pass`, sourceKey: K.levy }];
}
