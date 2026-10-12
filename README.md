# SimPPS

A sandbox game about Portland Public Schools' closures and budget.

## Why?

I live in Portland, near a school that is slated to be closed, and want to understand what's going to happen and why.  I wondered if a playable simulation might help me understand the situation better.

## Built with AI
This was built entirely by Anthropic's Claude AI agent, including research of public data sources on the web, game design and implementation.  It has used about 0.5B tokens so far, with a 97% cache hit rate -- probably about 20 kWh of electricity, or 70 miles of EV driving.  I hope this turns out to be a worthwhile use of energy!

## Development

```sh
npm install
npm run dev     # play locally
npm test
npm run build   # typecheck and build to dist/
npm run e2e     # phone-size Playwright run; SCREENSHOT_DIR=… saves screenshots
```

`?seed=abc&start=status-quo|scenario-a|scenario-b` picks a game. Without `start` the game asks. Played years are saved in the browser by seed and start.

Pushes to `main` deploy to GitHub Pages once the repo is public and Pages uses GitHub Actions.

## Data

`src/data/*.json` is built from [meub/pps-data](https://github.com/meub/pps-data) (MIT, © Alex Meub):

```sh
git clone https://github.com/meub/pps-data /tmp/pps-data
npm run data -- /tmp/pps-data
```
