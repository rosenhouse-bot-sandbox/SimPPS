import { useEffect, useRef, useState } from 'preact/hooks';
import type { Season, YearReport } from '../sim/types';
import { Sourced } from './Sourced';

export const SEASONS: { id: Season; name: string; month: string }[] = [
  { id: 'spring', name: 'Spring', month: 'APR' },
  { id: 'summer', name: 'Summer', month: 'JUL' },
  { id: 'fall', name: 'Fall', month: 'SEP' },
  { id: 'october', name: 'October', month: 'OCT' },
  { id: 'winter', name: 'Winter', month: 'DEC' },
];

const TICK_MS = 100;

interface PlaybackProps {
  report: YearReport;
  onDone: () => void;
  onSeason?: (s: Season) => void;
  durationMs?: number;
}

/** Plays the year's seasons. A tap pauses; Skip jumps to the report. */
export function Playback({ report, onDone, onSeason, durationMs = 30_000 }: PlaybackProps) {
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const done = useRef(false);
  const perSeason = durationMs / SEASONS.length;
  const index = Math.min(SEASONS.length - 1, Math.floor(elapsed / perSeason));
  const season = SEASONS[index];

  const skip = useRef<HTMLButtonElement>(null);
  useEffect(() => skip.current?.focus(), []);

  /** Time comes from the clock, so a slow frame doesn't stretch the year. */
  useEffect(() => {
    if (paused) return;
    const from = Date.now() - elapsed;
    const t = setInterval(() => setElapsed(Date.now() - from), TICK_MS);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    onSeason?.(season.id);
  }, [season.id]);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  useEffect(() => {
    if (elapsed >= durationMs) finish();
  }, [elapsed]);

  const events = report.events.filter((e) => e.season === season.id);
  return (
    <div class="playback" data-testid="playback">
      <button type="button" class="playback-stage" aria-label={paused ? 'Resume' : 'Pause'} onClick={() => setPaused(!paused)}>
        <span class="season num">{season.name}</span>
        {paused && <span class="paused num">PAUSED</span>}
        <progress max={durationMs} value={elapsed} />
      </button>
      <div class="window ticker" aria-live="polite">
        <div class="window-body">
          {events.length ? (
            <ul>
              {events.map((e) => (
                <li key={e.title}>
                  <Sourced k={e.sourceKey} text>
                    <strong>{e.title}</strong> {e.detail}
                  </Sourced>
                </li>
              ))}
            </ul>
          ) : (
            <p class="note">A quiet season.</p>
          )}
        </div>
      </div>
      <button ref={skip} type="button" class="btn skip" onClick={finish}>
        Skip
      </button>
    </div>
  );
}
