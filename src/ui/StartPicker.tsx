import { SCENARIOS, type Start } from '../sim';
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

export function StartPicker({ onPick }: { onPick: (s: Start) => void }) {
  return (
    <div class="scrim">
      <Window title="New game" class="panel sheet start-picker">
        <p class="intro">You run Portland Public Schools' K-8 schools, starting in January 2027.</p>
        <p class="intro">
          Each year, you plan changes: close schools, redraw boundaries, set class sizes or ask voters for a levy. Then you play the
          year and see how families respond.
        </p>
        <p class="intro">There is no score to win. Each year-end report compares your district with one where nothing changed.</p>
        <p class="intro">To plan, pick a school or the $ button. To play the year, press ▶.</p>
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
      </Window>
    </div>
  );
}
