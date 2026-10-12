import type { Reveal } from '../sim/types';
import { getSource } from '../sources/registry';
import { drawnLabel, TAG_NAMES } from './Sourced';

const W = 320;
const BASE = 112;
const TALL = 72;

function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A hidden card's possible values, this game's draw, the reasoning and the studies behind it. */
export function RevealSheet({ reveal }: { reveal: Reveal }) {
  const source = getSource(reveal.sourceKey)!;
  const card = source.hidden!;
  const total = card.outcomes.reduce((a, o) => a + o.weight, 0);
  const top = Math.max(...card.outcomes.map((o) => o.weight));
  const chances = card.outcomes.map((o) => o.weight / total);
  const even = chances.every((c) => c === chances[0]);
  const drawn = drawnLabel(card, reveal.value);
  const summary = even
    ? `Possible values: ${list(card.outcomes.map((o) => o.label))}, each ${pct(chances[0])} likely. This game drew ${drawn}.`
    : `Possible values: ${list(card.outcomes.map((o, i) => `${o.label} (${pct(chances[i])} likely)`))}. This game drew ${drawn}.`;
  const slot = W / card.outcomes.length;
  const bar = Math.min(56, slot * 0.6);
  return (
    <section class="reveal" aria-label={`Revealed: ${source.label}`}>
      <h3>Hidden card: {source.label}</h3>
      <svg class="histogram" viewBox={`0 0 ${W} 136`} role="img" aria-label={summary}>
        <line class="baseline" x1="0" x2={W} y1={BASE} y2={BASE} />
        {card.outcomes.map((o, i) => {
          const h = (TALL * o.weight) / top;
          const x = slot * i + (slot - bar) / 2;
          const mine = o.value === reveal.value;
          return (
            <g key={o.label} data-outcome={o.label} {...(mine ? { 'data-drawn': '' } : {})} class={mine ? 'drawn' : undefined}>
              <title>{`${o.label}: ${pct(chances[i])} likely${mine ? ', this game' : ''}`}</title>
              <rect x={x} y={BASE - h} width={bar} height={h} rx="2" />
              <text x={x + bar / 2} y={BASE - h - 4} text-anchor="middle">
                {mine ? 'This game' : pct(chances[i])}
              </text>
              <text x={x + bar / 2} y={BASE + 18} text-anchor="middle">
                {o.label}
              </text>
            </g>
          );
        })}
      </svg>
      <table class="sr-only">
        <thead>
          <tr>
            <th scope="col">Value</th>
            <th scope="col">Chance</th>
            <th scope="col">
              <span class="sr-only">Drawn</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {card.outcomes.map((o, i) => (
            <tr key={o.label}>
              <td>{o.label}</td>
              <td>{pct(chances[i])}</td>
              <td>{o.value === reveal.value ? 'This game' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <strong>This game drew {drawn}.</strong> {source.explain}
      </p>
      <p class="tag">
        [{source.tag}] {TAG_NAMES[source.tag]}
      </p>
      <ul class="links">
        {source.links.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
