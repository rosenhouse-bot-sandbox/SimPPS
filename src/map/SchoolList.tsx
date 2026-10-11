import { useState } from 'preact/hooks';
import { SCHOOLS, type Level } from '../data';
import type { SchoolId, SchoolState } from '../sim/types';

export interface SchoolListProps {
  /** Marks closed schools when given. */
  schools?: Record<SchoolId, SchoolState>;
  selected: SchoolId | null;
  onSelectSchool: (id: SchoolId) => void;
}

const LEVEL_LABELS: Record<Level, string> = { K5: 'K-5', K8: 'K-8', MS: '6-8', ALT: 'Alt', HS: 'HS' };

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const SORTED = [...SCHOOLS].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

/** The menu path to every school the map can select. */
export function SchoolList({ schools, selected, onSelectSchool }: SchoolListProps) {
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const groups = new Map<string, typeof SORTED>();
  for (const s of SORTED) {
    if (q && !fold(s.name).includes(q)) continue;
    const letter = fold(s.name)[0].toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), s]);
  }
  return (
    <div class="pps-school-list">
      <input
        type="search"
        aria-label="Find a school"
        placeholder="Find a school"
        value={query}
        onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
      />
      {[...groups].map(([letter, list]) => (
        <section key={letter} aria-label={letter}>
          <h3>{letter}</h3>
          <ul>
            {list.map((s) => (
              <li key={s.id}>
                <button type="button" aria-pressed={s.id === selected} onClick={() => onSelectSchool(s.id)}>
                  {s.name}
                  <small>
                    {LEVEL_LABELS[s.level]}
                    {schools?.[s.id]?.open === false ? ' · closed' : ''}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
