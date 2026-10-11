import type { Dials, Flows, YearReport } from '../sim/types';
import { fmtCount, fmtMoney, fmtPct } from './format';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

const FLOW_ROWS: { key: keyof Flows; label: string }[] = [
  { key: 'stayed', label: 'Stayed' },
  { key: 'movedWithinPps', label: 'Moved in PPS' },
  { key: 'leftPps', label: 'Left PPS' },
  { key: 'cameBack', label: 'Came back' },
];

const DIAL_NAMES: Record<keyof Dials, string> = {
  kids: 'Kids',
  capture: 'Capture',
  kindergartenCapture: 'K capture',
  gap: 'Gap',
  positionsCut: 'Positions cut',
  reservePct: 'Reserves',
  kidsInUrm: 'Kids in URM',
};

export function fmtDial(dial: keyof Dials, v: number): string {
  if (dial === 'gap') return fmtMoney(v);
  if (dial === 'capture' || dial === 'kindergartenCapture' || dial === 'reservePct') return fmtPct(v);
  return fmtCount(v);
}

function WhereKidsWent({ flows }: { flows: Flows }) {
  const max = Math.max(1, ...FLOW_ROWS.map((r) => flows[r.key]));
  return (
    <dl class="flows">
      {FLOW_ROWS.map((r) => (
        <div key={r.key} class="flow">
          <dt>{r.label}</dt>
          <dd>
            <span class="bar" style={{ width: `${(100 * flows[r.key]) / max}%` }} />
            <Sourced k={K.flows} modeled>
              {fmtCount(flows[r.key])}
            </Sourced>
          </dd>
        </div>
      ))}
    </dl>
  );
}

interface ReportProps {
  report: YearReport;
  turn: number;
  onNext: () => void;
}

export function ReportView({ report, turn, onNext }: ReportProps) {
  return (
    <Window title={`DEC ${report.year} · YEAR ${turn}`} class="panel report">
      <h3>Where kids went</h3>
      <WhereKidsWent flows={report.flows} />
      <h3>Vs. do-nothing ghost</h3>
      {report.vsGhost.length === 0 && <p class="note">No difference yet.</p>}
      <ul class="ghost">
        {report.vsGhost.slice(0, 3).map((g) => (
          <li key={g.dial}>
            <span aria-label={g.better ? 'better' : 'worse'}>{g.better ? '▲' : '▼'}</span> {DIAL_NAMES[g.dial]}{' '}
            <Sourced k={K.ghost} modeled>
              {`${fmtDial(g.dial, g.you)} vs ${fmtDial(g.dial, g.ghost)}`}
            </Sourced>
          </li>
        ))}
      </ul>
      <section class="bulletin" aria-label="The Bulletin">
        <h3>
          <Sourced k={K.bulletin}>The Bulletin</Sourced> <span class="stamp">SIMULATION</span>
        </h3>
        <ul>
          {report.headlines.slice(0, 3).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>
      <button type="button" class="btn primary wide" onClick={onNext}>
        Plan {report.year + 1}
      </button>
    </Window>
  );
}
