import { render } from 'preact';
import '@fontsource/vt323/400.css';
import './ui/styles.css';
import { App } from './app/App';
import * as sim from './sim';

const seed = new URLSearchParams(location.search).get('seed') ?? Math.random().toString(36).slice(2, 8);

render(<App sim={sim} seed={seed} />, document.getElementById('app')!);
