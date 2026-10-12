import type { BoundaryChip } from '../sim';
import type { BoundaryEdit, SchoolId, ZoneLevel } from '../sim/types';
import { BoundaryChipView } from './BoundaryChip';
import { nameOf } from './closeSend';
import { Stepper } from './Stepper';
import { K } from './sources';
import { Term, WithMark } from './Term';
import { startZoneDraft, undoStroke, type ZoneDraft } from './zoneEdit';
import { Window } from './Window';

const LEVELS: { id: ZoneLevel; label: string }[] = [
  { id: 'elementary', label: 'K-5/K-8' },
  { id: 'middle', label: '6-8' },
];

const SLICE = { start: 25, min: 5, max: 100, step: 5 };

interface ZoneSheetProps {
  draft: ZoneDraft;
  /** The draft's cells, its slice included, as the plan would get them. */
  edit: BoundaryEdit;
  /** Null until a block changes zone. */
  chip: BoundaryChip | null;
  /** Schools that can take blocks at a level. */
  targetsFor: (level: ZoneLevel) => { id: SchoolId; name: string }[];
  /** Zones a slice can come from, nearest the target first. */
  sources: SchoolId[];
  onChange: (d: ZoneDraft) => void;
  onCommit: (e: BoundaryEdit) => void;
  onClose: () => void;
}

/** Zone mode: paint blocks on the map, or slice a share of a neighboring zone. */
export function ZoneSheet({ draft, edit, chip, targetsFor, sources, onChange, onCommit, onClose }: ZoneSheetProps) {
  const pickLevel = (level: ZoneLevel) => {
    if (level === draft.level) return;
    const next = targetsFor(level);
    onChange(startZoneDraft(level, next.some((t) => t.id === draft.to) ? draft.to : next[0].id));
  };
  const { slice } = draft;
  const grandfather = (
    <label class="row choice">
      <input type="checkbox" checked={draft.grandfather} onChange={() => onChange({ ...draft, grandfather: !draft.grandfather })} />
      <span>
        <WithMark text="Grandfather current kids" t="Grandfather" />
      </span>
    </label>
  );
  const body = chip && (
    <>
      <BoundaryChipView chip={chip} blocks={edit.cells.length} />
      {!chip.contiguous && (
        <p class="note warn" role="alert">
          Blocks don't touch the zone.
        </p>
      )}
    </>
  );
  const add = (
    <button type="button" class="btn primary" disabled={!chip} onClick={() => onCommit(edit)}>
      Add to plan
    </button>
  );

  return (
    <Window title={`Zone: ${nameOf(draft.to)}`} onClose={onClose} class="panel sheet zonesheet">
      {slice ? (
        <>
          <p class="slice-says">
            <WithMark text={`Move the ${slice.percent}% of ${nameOf(slice.from)} nearest ${nameOf(draft.to)}`} t="Slice" />
          </p>
          <Stepper
            label="Share"
            labelNode={
              <select
                aria-label="Zone"
                value={slice.from}
                onChange={(e) => onChange({ ...draft, slice: { ...slice, from: e.currentTarget.value } })}
              >
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {nameOf(s)}
                  </option>
                ))}
              </select>
            }
            value={slice.percent}
            min={SLICE.min}
            max={SLICE.max}
            step={SLICE.step}
            format={(n) => `${n}%`}
            sourceKey={K.zoneGrid}
            onChange={(percent) => onChange({ ...draft, slice: { ...slice, percent } })}
          />
          {body}
          {grandfather}
          <div class="actions">
            <button type="button" class="btn" onClick={() => onChange({ ...draft, slice: undefined })}>
              Back
            </button>
            {add}
          </div>
        </>
      ) : (
        <>
          <div class="row levels" role="group" aria-label="Level">
            <Term t="Zone" />
            {LEVELS.map((l) => (
              <button key={l.id} type="button" class="btn" aria-pressed={draft.level === l.id} onClick={() => pickLevel(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <label class="row pickrow">
            <span>Paint into</span>
            <select value={draft.to} onChange={(e) => onChange({ ...draft, to: e.currentTarget.value })}>
              {targetsFor(draft.level).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {body ?? <p class="note">One finger paints. Two pan.</p>}
          {grandfather}
          <div class="actions">
            <button type="button" class="btn" aria-label="Undo stroke" disabled={!draft.strokes.length} onClick={() => onChange(undoStroke(draft))}>
              Undo
            </button>
            <button
              type="button"
              class="btn"
              disabled={!sources.length}
              onClick={() => onChange({ ...draft, slice: { from: sources[0], percent: SLICE.start } })}
            >
              Slice…
            </button>
            {add}
          </div>
        </>
      )}
    </Window>
  );
}
