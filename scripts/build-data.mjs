// Builds src/data/*.json from a checkout of github.com/meub/pps-data.
// Usage: node scripts/build-data.mjs <path-to-pps-data>
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const repo = process.argv[2];
if (!repo) throw new Error('usage: build-data.mjs <path-to-pps-data>');
const out = new URL('../src/data/', import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(join(repo, p), 'utf8'));

// Equirectangular projection to meters around central Portland. +y is south.
const LAT0 = 45.52, LON0 = -122.66;
const M_PER_DEG_LAT = 111_132;
const M_PER_DEG_LON = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
const project = ([lon, lat]) => [
  Math.round((lon - LON0) * M_PER_DEG_LON),
  Math.round((LAT0 - lat) * M_PER_DEG_LAT),
];

function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1, worstD = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worstD > tolerance) {
      keep[worst] = true;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// A closed ring starts and ends on the same point, so split it at the vertex farthest from the start.
function simplifyRing(ring, tolerance) {
  const [x0, y0] = ring[0];
  let far = 0;
  ring.forEach(([x, y], i) => { if (Math.hypot(x - x0, y - y0) > Math.hypot(ring[far][0] - x0, ring[far][1] - y0)) far = i; });
  return [...simplify(ring.slice(0, far + 1), tolerance).slice(0, -1), ...simplify(ring.slice(far), tolerance)];
}

const rings = (geometry) =>
  (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates)
    .map((poly) => simplifyRing(poly[0].map(project), 25));

const slug = (name) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\b(elementary|middle|high|school|k-8|program)\b/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ZONE_ALIASES = {
  'boise-eliot-humboldt': 'boise-eliot',
  'mlk-jr': 'dr-martin-luther-king-jr',
  'tubman': 'harriet-tubman',
  'bridger': 'bridger-creative-science',
  'sunnyside': 'sunnyside-environmental',
  'jefferson-grant': 'jefferson', 'jefferson-mcdaniel': 'jefferson', 'jefferson-roosevelt': 'jefferson',
  'ida-b-wells': 'ida-b-wells-barnett',
  'mcdaniel': 'leodis-v-mcdaniel',
};
const zoneSchoolId = (name) => ZONE_ALIASES[slug(name)] ?? slug(name);

function parseCsv(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const LEVELS = { elementary: 'K5', k8: 'K8', middle: 'MS', alternative: 'ALT', other: 'K5', high: 'HS' };
const YEARS = ['2026_27', '2027_28', '2028_29', '2029_30', '2030_31', '2031_32', '2032_33', '2033_34', '2034_35', '2035_36'];

const web = readJson('web/data.json');
const schools = web.schools.map((s) => {
  const [x, y] = project([s.longitude, s.latitude]);
  return {
    id: slug(s.school_name),
    name: s.school_name.trim(),
    level: LEVELS[s.level],
    x, y,
    enrollment: num(s.enrollment_2025_26),
    history: Object.fromEntries(
      ['2018', '2019', '2020', '2021', '2022', '2023'].map((y) => [y, num(s[`enrollment_${y}`])])
        .concat([['2024', num(s.enrollment_2024_25)], ['2025', num(s.enrollment_2025_26)]])),
    forecast: Object.fromEntries(YEARS.map((y) => [y.slice(0, 4), num(s[`enrollment_forecast_${y}`])])),
    forecast2035Low: num(s.enrollment_forecast_2035_36_low),
    forecast2035High: num(s.enrollment_forecast_2035_36_high),
    capacity: num(s.functional_capacity_model) ?? num(s.functional_capacity_2021),
    squareFeet: num(s.square_feet),
    yearBuilt: num(s.year_built),
    isUrm: s.is_urm_building === true,
    retrofitRemaining: num(s.retrofit_cost_remaining_usd),
    pctDirectCert: num(s.pct_direct_cert),
    pctFrl: num(s.pct_frl),
    pctBipoc: num(s.pct_bipoc),
    isTitleI: s.is_title_i === true,
    dliLanguages: s.dli_languages || null,
    dliStudents: num(s.dli_students_2526),
    hasFocusOption: s.has_focus_option === true,
    scenarioA: s.rs_a_detail || null,
    scenarioB: s.rs_b_detail || null,
  };
});

const highs = parseCsv(readFileSync(join(repo, 'data/pps_schools.csv'), 'utf8'))
  .filter((r) => r.level === 'high')
  .map((r) => {
    const [x, y] = project([Number(r.longitude), Number(r.latitude)]);
    return { id: slug(r.school_name), name: r.school_name.trim(), level: 'HS', x, y, enrollment: num(r.enrollment_2025_26) };
  });

const ids = new Set([...schools, ...highs].map((s) => s.id));
const zones = {};
const missing = [];
for (const level of ['elementary', 'middle', 'high']) {
  const fc = readJson(`data/raw/pps_boundaries_${level}.geojson`);
  zones[level] = fc.features.map((f) => {
    const school = zoneSchoolId(f.properties.school_name);
    if (!ids.has(school)) missing.push(`${f.properties.school_name} -> ${school}`);
    return { name: f.properties.school_name, school, rings: rings(f.geometry) };
  });
}

if (missing.length) throw new Error(`zones without a school: ${missing.join(", ")}`);
const fieldSources = Object.fromEntries(
  Object.entries(web.meta).map(([k, v]) => [k, { label: v.label, desc: v.desc, source: v.source }]));

const commit = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const write = (name, data) => writeFileSync(join(out, name), JSON.stringify(data) + '\n');
write('schools.json', { ppsDataCommit: commit, schools, highSchools: highs });
write('zones.json', zones);
write('field-sources.json', fieldSources);
write('rightsizing.json', readJson('data/raw/pps_rightsizing_scenarios.json'));
console.log(`${schools.length} schools, ${highs.length} high schools, ` +
  Object.entries(zones).map(([k, v]) => `${v.length} ${k} zones`).join(', '));
