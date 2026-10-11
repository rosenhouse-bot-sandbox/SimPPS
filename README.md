# SimPPS

A mobile-web sandbox game about Portland Public Schools' closures and budget. The design lives in issue #1, and the alpha plan in issue #2.

```sh
npm install
npm run dev     # play locally
npm test
```

## Data

`src/data/*.json` is built from [meub/pps-data](https://github.com/meub/pps-data) (MIT, © Alex Meub):

```sh
git clone https://github.com/meub/pps-data /tmp/pps-data
npm run data -- /tmp/pps-data
```
