import { useState } from 'preact/hooks';
import { SCENARIOS, type Start } from '../sim';
import type { ModelOverrides } from '../sim/types';
import { ModelParams } from './ModelParams';
import { ScenarioBadge } from './PlanPanel';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

const STARTS = Object.keys(SCENARIOS) as Start[];

function blurb(start: Start): string {
  const { closures, gradeChanges, programMoveCount } = SCENARIOS[start];
  if (!closures.length) return "Today's schools and budget.";
  return `Starts with PPS's ${closures.length} proposed closures, ${gradeChanges.length} grade-span changes and ${programMoveCount} program moves.`;
}

interface StartPickerProps {
  onPick: (s: Start) => void;
  /** Changed model parameters for the new game. */
  model?: ModelOverrides;
  onModel?: (model: ModelOverrides) => void;
}

export function StartPicker({ onPick, model = {}, onModel = () => {} }: StartPickerProps) {
  const [advanced, setAdvanced] = useState(false);
  const changed = Object.keys(model).length;
  if (advanced)
    return (
      <div class="scrim">
        <ModelParams model={model} onChange={onModel} onClose={() => setAdvanced(false)} />
      </div>
    );
  return (
    <div class="scrim">
      <Window title="New game" class="panel sheet start-picker">
        <p class="intro">You run Portland Public Schools' K-8 schools, starting in January 2027.</p>
        <p class="intro">
          Each year, you plan changes: close schools, redraw boundaries, set class sizes or ask voters for a levy. Then you play the
          year and see how families respond.
        </p>
        <p class="intro">There is no score to win. Each year-end report compares your district with one where nothing changed.</p>
        <p class="intro">To plan, pick a school or the $ button. To play the year, hold End.</p>
        <ul class="starts">
          {STARTS.map((s) => (
            <li key={s}>
              <button type="button" class="btn wide" onClick={() => onPick(s)}>
                {SCENARIOS[s].label}
              </button>
              <p class="note">
                {SCENARIOS[s].closures.length ? (
                  <Sourced k={K.scenarios} text>
                    {blurb(s)}
                  </Sourced>
                ) : (
                  blurb(s)
                )}
              </p>
              <ScenarioBadge start={s} />
            </li>
          ))}
        </ul>
        {changed > 0 && <p class="badge">{`This game changes ${changed} model parameter${changed === 1 ? '' : 's'}.`}</p>}
        <button type="button" class="btn wide" onClick={() => setAdvanced(true)}>
          Advanced: model parameters
        </button>
      </Window>
    </div>
  );
}
