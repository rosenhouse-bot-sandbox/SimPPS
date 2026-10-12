import { fmtMoney } from '../format';
import { FATE_DONE } from '../sim';
import type { BoundaryEdit, Closure, GradeSpanChange, Policy, ProgramMove } from '../sim/types';
import { nameOf } from './closeSend';
import { K } from './sources';

export interface EditLine {
  text: string;
  sourceKey: string;
  /** The patch that takes this edit back out of the draft. */
  undo?: Partial<Policy>;
}

export function closureText(c: Closure): string {
  const to = c.receivers.map((r) => (c.receivers.length > 1 ? `${nameOf(r.school)} ${Math.round(r.share * 100)}%` : nameOf(r.school)));
  return `Close ${nameOf(c.school)} → ${to.join(', ')}${c.building === 'mothball' ? '' : ` · ${FATE_DONE[c.building]}`}`;
}

export function boundaryText(e: BoundaryEdit): string {
  const blocks = `${e.cells.length} block${e.cells.length === 1 ? '' : 's'}`;
  return `Rezone ${blocks} → ${nameOf(e.to)}${e.level === 'middle' ? ' 6-8' : ''}${e.grandfather ? ' · grandfathered' : ''}`;
}

export function gradeSpanText(g: GradeSpanChange): string {
  return `Send ${nameOf(g.school)} 6–8 → ${nameOf(g.to)}`;
}

export function programMoveText(m: ProgramMove): string {
  return `Move ${m.program} DLI: ${m.from.map(nameOf).join(', ')} → ${nameOf(m.to)}`;
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
  for (const g of draft.gradeChanges)
    out.push({ text: gradeSpanText(g), sourceKey: K.gradeSpan, undo: { gradeChanges: draft.gradeChanges.filter((x) => x !== g) } });
  for (const m of draft.programMoves)
    out.push({ text: programMoveText(m), sourceKey: K.programMove, undo: { programMoves: draft.programMoves.filter((x) => x !== m) } });
  for (const e of draft.boundaryEdits)
    out.push({ text: boundaryText(e), sourceKey: K.zoneGrid, undo: { boundaryEdits: draft.boundaryEdits.filter((x) => x !== e) } });
  if (draft.k5ClassSize !== base.k5ClassSize)
    out.push({
      text: `K-5 class size ${base.k5ClassSize} → ${draft.k5ClassSize}`,
      sourceKey: K.classSize,
      undo: { k5ClassSize: base.k5ClassSize },
    });
  if (draft.levyRate !== base.levyRate)
    out.push({ text: `Levy ${fmtLevy(base.levyRate)} → ${fmtLevy(draft.levyRate)}`, sourceKey: K.levyRate, undo: { levyRate: base.levyRate } });
  if (draft.reserveDraw > 0)
    out.push({ text: `Draw ${fmtMoney(draft.reserveDraw)} from reserves`, sourceKey: K.reserveDraw, undo: { reserveDraw: 0 } });
  return out;
}
