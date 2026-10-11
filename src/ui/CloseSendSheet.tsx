import { useState } from 'preact/hooks';
import { fmtCount, fmtMiles, fmtMoney, fmtMoneyRange, fmtRange } from '../format';
import { modeledRange, MOTHBALL_PER_YEAR, type ClosureChip } from '../sim';
import type { BuildingFate, Closure } from '../sim/types';
import { NEARBY, nameOf, toClosure, toggleReceiver, type Candidate, type CloseDraft } from './closeSend';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Stepper } from './Stepper';
import { Window } from './Window';

function Seats({ kids, capacity }: { kids: number; capacity: number }) {
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
          <dt>Seats</dt>
          <dd class="num">
            <Seats {...chip.seats} />
          </dd>
        </div>
        <div>
          <dt>Walk</dt>
          <dd class="num">
            <Sourced k={K.closureWalk}>{`${fmtMiles(chip.walkMiles, true)}~`}</Sourced>
          </dd>
        </div>
        <div>
          <dt>Now</dt>
          <dd class="num">
            <Sourced k={K.closureOneTime}>{fmtMoneyRange(chip.now)}</Sourced>
          </dd>
        </div>
        <div>
          <dt>
            At maturity, <Sourced k={K.closurePhasing}>{String(chip.maturesIn)}</Sourced>
          </dt>
          <dd class="num">
            <Sourced k={K.closureSavings}>{fmtMoneyRange(chip.atMaturity)}</Sourced>
          </dd>
        </div>
      </dl>
      <p class="pays">
        Pays off if fewer than <Sourced k={K.paysOff}>{`${fmtCount(chip.paysOffIfFewerThan)}~`}</Sourced> leave PPS
        {chip.busRiders > 0 && (
          <>
            . <Sourced k={K.busing}>{`${fmtCount(chip.busRiders)}~`}</Sourced> new bus riders
          </>
        )}
      </p>
    </div>
  );
}

function Pick({ c, picked, onToggle }: { c: Candidate; picked: boolean; onToggle: () => void }) {
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

function StepHead({ title, step }: { title: string; step?: number }) {
  return (
    <h3 class="step-head">
      {title}
      {step && <span class="steps">{step} of 3</span>}
    </h3>
  );
}

const FATES: { id: BuildingFate; label: string; cost: number }[] = [
  { id: 'mothball', label: 'Mothball', cost: MOTHBALL_PER_YEAR },
  { id: 'lease', label: 'Lease', cost: 0 },
  { id: 'sell', label: 'Sell', cost: 0 },
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

  return (
    <Window title={`Close ${nameOf(draft.school)}`} onClose={onClose} class="panel sheet closesend">
      {draft.step === 1 && (
        <>
          <StepHead title="Send kids to" step={1} />
          <p class="note">Pick 1 or 2. Tap the map too.</p>
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
                value={draft.firstShare}
                min={10}
                max={90}
                step={10}
                format={(n) => `${n}%`}
                onChange={(firstShare) => onChange({ ...draft, firstShare })}
              />
              <div class="row share">
                <span>{picked[1].name}</span>
                <Sourced k={K.share}>{`${100 - draft.firstShare}%`}</Sourced>
              </div>
            </>
          ) : (
            <div class="row share">
              <span>{picked[0].name}</span>
              <Sourced k={K.share}>100%</Sourced>
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
            <legend class="sr">Building</legend>
            {FATES.map((f) => (
              <label key={f.id} class="row choice">
                <input
                  type="radio"
                  name="building"
                  checked={draft.building === f.id}
                  onChange={() => onChange({ ...draft, building: f.id })}
                />
                <span class="fate">{f.label}</span>
                <Sourced k={K.buildingFate}>{`${fmtMoney(f.cost)}/yr`}</Sourced>
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
