import { useState } from 'preact/hooks';
import { fmtCount, fmtMiles, fmtMoney, fmtMoneyRange, fmtRange } from '../format';
import { DLI_PROGRAMS, modeledRange, type ClosureChip } from '../sim';
import { M } from '../sim/model';
import type { BuildingFate, Closure } from '../sim/types';
import { NEARBY, nameOf, toClosure, toggleReceiver, type Candidate, type CloseDraft } from './closeSend';
import { Sourced } from './Sourced';
import { K } from './sources';
import type { GlossaryTerm } from './glossary';
import { Stepper } from './Stepper';
import { Term, WithMark } from './Term';
import { Window } from './Window';

export function Seats({ kids, capacity }: { kids: number; capacity: number }) {
  return (
    <span class="seats">
      <Sourced k={K.enrollment}>{fmtRange(modeledRange(kids))}</Sourced>/<Sourced k={K.capacity}>{fmtCount(capacity)}</Sourced>
    </span>
  );
}

/** Arithmetic for a closure if every kid follows. It never predicts family choices. */
export function ClosureChipView({ chip }: { chip: ClosureChip }) {
  return (
    <div class="chip closure-chip" data-testid="closure-chip">
      <dl>
        <div>
          <dt>
            <Term t="Seats" />
          </dt>
          <dd class="num">
            <Seats {...chip.seats} />
          </dd>
        </div>
        <div>
          <dt>
            <Term t="Walk" />
          </dt>
          <dd class="num">
            <Sourced k={K.closureWalk} term="Walk">{`${fmtMiles(chip.walkMiles, true)}~`}</Sourced>
          </dd>
        </div>
        <div>
          <dt>
            <Term t="Now" />
          </dt>
          <dd class="num">
            <Sourced k={K.closureOneTime} term="Now">{fmtMoneyRange(chip.now)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>
            <Term t="At maturity" />, <Sourced k={K.closurePhasing}>{String(chip.maturesIn)}</Sourced>
          </dt>
          <dd class="num">
            <Sourced k={K.closureSavings} term="At maturity">
              {fmtMoneyRange(chip.atMaturity)}
            </Sourced>
          </dd>
        </div>
      </dl>
      <p class="pays">
        <Term t="Pays off" /> if fewer than <Sourced k={K.paysOff} term="Pays off">{`${fmtCount(chip.paysOffIfFewerThan)}~`}</Sourced> leave PPS
        {chip.busRiders > 0 && (
          <>
            . <Sourced k={K.busing} term="New bus riders">{`${fmtCount(chip.busRiders)}~`}</Sourced>{' '}
            <Term t="New bus riders">new bus riders</Term>
          </>
        )}
      </p>
      {chip.programs.map((m) => (
        <p key={m.program} class="programs">
          <Sourced k={K.programMove} text>{`${m.program} DLI moves to ${nameOf(m.to)}.`}</Sourced>
        </p>
      ))}
    </div>
  );
}

export function Pick({ c, picked, onToggle }: { c: Candidate; picked: boolean; onToggle: () => void }) {
  return (
    <li class="row pick">
      <button type="button" class="pick-name" aria-pressed={picked} onClick={onToggle}>
        <span class="box" aria-hidden="true">
          {picked ? '■' : '□'}
        </span>
        {c.name}
      </button>
      <Sourced k={K.distance}>{fmtMiles(c.miles)}</Sourced>
      <Seats kids={c.kids} capacity={c.capacity} />
    </li>
  );
}

function StepHead({ title, step }: { title: GlossaryTerm; step?: number }) {
  return (
    <h3 class="step-head">
      <Term t={title} />
      {step && <span class="steps">{step} of 3</span>}
    </h3>
  );
}

const FATES: { id: BuildingFate; label: GlossaryTerm; cost: () => number }[] = [
  { id: 'mothball', label: 'Mothball', cost: () => M.mothball },
  { id: 'lease', label: 'Lease', cost: () => 0 },
  { id: 'sell', label: 'Sell', cost: () => 0 },
];

interface CloseSendProps {
  draft: CloseDraft;
  /** Schools that can take the kids, nearest first. */
  candidates: Candidate[];
  chipFor: (c: Closure) => ClosureChip;
  onChange: (d: CloseDraft) => void;
  onCommit: (c: Closure) => void;
  onClose: () => void;
}

/** Close & send in three steps, then an optional guess. The plan gets the closure at step 3. */
export function CloseSendSheet({ draft, candidates: all, chipFor, onChange, onCommit, onClose }: CloseSendProps) {
  const [az, setAz] = useState(false);
  const picked = draft.receivers.map((id) => all.find((c) => c.id === id)).filter((c): c is Candidate => !!c);
  const shown = az ? [...all].sort((a, b) => a.name.localeCompare(b.name)) : all.slice(0, NEARBY);
  const extra = az ? [] : picked.filter((c) => !shown.includes(c));
  const chip = picked.length ? chipFor(toClosure(draft)) : null;
  const [guess, setGuess] = useState<number | null>(null);
  const go = (step: CloseDraft['step']) => onChange({ ...draft, step });
  const toggle = (id: string) => onChange(toggleReceiver(draft, id));
  const dli = DLI_PROGRAMS.get(draft.school)?.join(' and ');

  return (
    <Window title={`Close ${nameOf(draft.school)}`} onClose={onClose} class="panel sheet closesend">
      {draft.step === 1 && (
        <>
          <StepHead title="Send kids to" step={1} />
          <p class="note">Pick 1 or 2. Tap the map too.</p>
          {dli && (
            <p class="note">
              <Sourced k={K.programMove} term="DLI" text>{`Its ${dli} dual-language (DLI) program moves with it.`}</Sourced>
            </p>
          )}
          <ul class="picks">
            {[...extra, ...shown].map((c) => (
              <Pick key={c.id} c={c} picked={draft.receivers.includes(c.id)} onToggle={() => toggle(c.id)} />
            ))}
          </ul>
          <button type="button" class="row link" aria-expanded={az} onClick={() => setAz(!az)}>
            {az ? 'Nearest only' : 'All schools A–Z'}
          </button>
          <div class="actions">
            <button type="button" class="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" class="btn primary" disabled={!picked.length} onClick={() => go(2)}>
              Next &gt;
            </button>
          </div>
        </>
      )}
      {draft.step === 2 && chip && (
        <>
          <StepHead title="Shares" step={2} />
          {picked.length === 2 ? (
            <>
              <Stepper
                label={picked[0].name}
                sourceKey={K.share}
                term="Shares"
                value={draft.firstShare}
                min={10}
                max={90}
                step={10}
                format={(n) => `${n}%`}
                onChange={(firstShare) => onChange({ ...draft, firstShare })}
              />
              <div class="row share">
                <span>{picked[1].name}</span>
                <Sourced k={K.share} term="Shares">{`${100 - draft.firstShare}%`}</Sourced>
              </div>
            </>
          ) : (
            <div class="row share">
              <span>{picked[0].name}</span>
              <Sourced k={K.share} term="Shares">
                100%
              </Sourced>
            </div>
          )}
          <ClosureChipView chip={chip} />
          <div class="actions">
            <button type="button" class="btn" onClick={() => go(1)}>
              Back
            </button>
            <button type="button" class="btn primary" onClick={() => go(3)}>
              Next &gt;
            </button>
          </div>
        </>
      )}
      {draft.step === 3 && chip && (
        <>
          <StepHead title="Building" step={3} />
          <fieldset class="fates">
            <legend class="sr-only">Building</legend>
            {FATES.map((f) => (
              <label key={f.id} class="row choice">
                <input
                  type="radio"
                  name="building"
                  checked={draft.building === f.id}
                  onChange={() => onChange({ ...draft, building: f.id })}
                />
                <span class="fate">
                  <WithMark text={f.label} t={f.label} />
                </span>
                <Sourced k={K.buildingFate}>{`${fmtMoney(f.cost())}/yr`}</Sourced>
              </label>
            ))}
          </fieldset>
          {draft.building === 'sell' && (
            <p class="note warn" role="alert">
              <Sourced k={K.buildingFate} text>
                A sold building can't reopen. Its money goes to capital, not teachers.
              </Sourced>
            </p>
          )}
          <ClosureChipView chip={chip} />
          <div class="actions">
            <button type="button" class="btn" onClick={() => go(2)}>
              Back
            </button>
            <button
              type="button"
              class="btn primary"
              onClick={() => {
                onCommit(toClosure(draft));
                go(4);
              }}
            >
              Close it
            </button>
          </div>
        </>
      )}
      {draft.step === 4 && chip && (
        <>
          <StepHead title="Call it" />
          <p>
            <Sourced k={K.enrollment}>{fmtRange(modeledRange(chip.kidsMoving))}</Sourced> kids must choose. How many stay in
            PPS?
          </p>
          <Stepper
            label="Stay in PPS"
            sourceKey={K.callIt}
            term="Call it"
            value={guess ?? draft.guess ?? chip.kidsMoving}
            min={0}
            max={chip.kidsMoving}
            step={5}
            format={fmtCount}
            onChange={setGuess}
          />
          <div class="actions">
            <button type="button" class="btn" onClick={onClose}>
              Skip
            </button>
            <button
              type="button"
              class="btn primary"
              onClick={() => {
                onCommit(toClosure(draft, guess ?? draft.guess ?? chip.kidsMoving));
                onClose();
              }}
            >
              Call it
            </button>
          </div>
        </>
      )}
    </Window>
  );
}
