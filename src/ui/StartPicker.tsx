import { SCENARIOS, type Start } from '../sim';
import { ScenarioBadge } from './PlanPanel';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

const STARTS = Object.keys(SCENARIOS) as Start[];

function blurb(start: Start): string {
  const n = SCENARIOS[start].closures.length;
  return n ? `${n} closures load as your first plan.` : "Today's schools and budget.";
}

export function StartPicker({ onPick }: { onPick: (s: Start) => void }) {
  return (
    <div class="scrim">
      <Window title="New game" class="panel sheet start-picker">
        <p class="note">Every start opens in January 2027.</p>
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
