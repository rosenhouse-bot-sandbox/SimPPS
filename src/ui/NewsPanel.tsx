import type { YearReport } from '../sim/types';
import { Sourced } from './Sourced';
import { Window } from './Window';

export function NewsPanel({ reports, onClose }: { reports: YearReport[]; onClose: () => void }) {
  const newestFirst = [...reports].reverse();
  return (
    <Window title="News" onClose={onClose} class="panel">
      <p class="stamp">SIMULATION</p>
      {newestFirst.length === 0 && <p class="note">No headlines yet. Play a year.</p>}
      {newestFirst.map((r) => (
        <section key={r.year} aria-label={`Bulletin ${r.year}`}>
          <h3>{r.year}</h3>
          <ul>
            {r.headlines.slice(0, 3).map((h) => (
              <li key={h.text}>
                <Sourced k={h.sourceKey} text>
                  {h.text}
                </Sourced>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Window>
  );
}
