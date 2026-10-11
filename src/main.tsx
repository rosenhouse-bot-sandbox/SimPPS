import { render } from 'preact';
import '@fontsource/vt323/400.css';
import './ui/styles.css';
import { App } from './app/App';
import { readUrl, writeUrl } from './app/url';
import * as sim from './sim';

const url = readUrl(location.search);
const seed = url.seed ?? Math.random().toString(36).slice(2, 8);
const keep = (start: sim.Start | null) => history.replaceState(null, '', writeUrl(location.search, seed, start));
keep(url.start);

render(<App sim={sim} seed={seed} start={url.start} onStart={keep} />, document.getElementById('app')!);
