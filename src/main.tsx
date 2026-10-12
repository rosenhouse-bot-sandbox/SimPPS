import { render } from 'preact';
import '@fontsource/vt323/400.css';
import './ui/styles.css';
import { App } from './app/App';
import { readModel, readUrl, writeUrl } from './app/url';
import * as sim from './sim';
import type { ModelOverrides, Policy } from './sim/types';

const url = readUrl(location.search);
const seed = url.seed ?? Math.random().toString(36).slice(2, 8);
let start = url.start;
let model = readModel(location.search);
const keep = (s: sim.Start | null, m: ModelOverrides) => {
  start = s;
  model = m;
  history.replaceState(null, '', writeUrl(location.search, seed, s, m));
};
keep(url.start, model);

/** Played plans survive a reload, by seed, start and changed model. Storage can be missing, so every access may fail. */
const key = () => `simpps:${seed}:${start}${Object.keys(model).length ? `:${JSON.stringify(model)}` : ''}`;
function load(): Policy[] {
  try {
    return start ? (JSON.parse(localStorage.getItem(key()) ?? '[]') as Policy[]) : [];
  } catch {
    return [];
  }
}
function save(played: Policy[]) {
  try {
    if (start) localStorage.setItem(key(), JSON.stringify(played));
  } catch {
    // The game plays on without saving.
  }
}
function newGame() {
  if (confirm('Leave this game and start a new one?')) location.search = '';
}

const root = document.getElementById('app')!;
// Preact renders beside the static loading text rather than replacing it.
root.replaceChildren();
function mount(saved: Policy[]) {
  render(
    <App sim={sim} seed={seed} start={start} model={model} saved={saved} onStart={keep} onSave={save} onNewGame={newGame} />,
    root,
  );
}

try {
  mount(load());
} catch {
  save([]);
  mount([]);
}
