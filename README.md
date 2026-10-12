# SimPPS

A mobile-web sandbox game about Portland Public Schools' closures and budget. The design lives in issue #1, and the alpha plan in issue #2.

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
