import type { ClosureOutcome, Dials, Flows, Range, YearReport } from '../sim/types';
import { fmtMoney, fmtPct, fmtRange } from '../format';
import { nameOf } from './closeSend';
import { Sourced } from './Sourced';
import { K } from './sources';
import { Window } from './Window';

type FlowRow = { label: string; n: (f: Flows) => number; total?: boolean };

const IN_PPS: FlowRow[] = [
  { label: 'Stayed', n: (f) => f.stayed },
  { label: 'Moved in PPS', n: (f) => f.movedWithinPps },
  { label: 'Came back', n: (f) => f.cameBack },
  { label: 'New kindergartners', n: (f) => f.enteredK },
];

const FLOW_ROWS: FlowRow[] = [
  ...IN_PPS,
  { label: 'Kids now', n: (f) => IN_PPS.reduce((a, r) => a + r.n(f), 0), total: true },
  { label: 'Left PPS', n: (f) => f.leftPps },
  { label: 'To high school', n: (f) => f.graduated },
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

function exact(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtDial(dial: keyof Dials, v: number): string {
  if (dial === 'gap') return fmtMoney(v);
  if (dial === 'capture' || dial === 'kindergartenCapture' || dial === 'reservePct') return fmtPct(v);
  return exact(v);
}

function WhereKidsWent({ flows }: { flows: Flows }) {
  const max = Math.max(1, ...FLOW_ROWS.map((r) => r.n(flows)));
  return (
    <dl class="flows">
      {FLOW_ROWS.map((r) => (
        <div key={r.label} class={r.total ? 'flow total' : 'flow'}>
          <dt>{r.label}</dt>
          <dd>
            <span class="bar" style={{ width: `${(100 * r.n(flows)) / max}%` }} />
            <Sourced k={r.total ? K.kids : K.flows} modeled>
              {exact(r.n(flows))}
            </Sourced>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OutcomeRow({ label, kids, of, k }: { label: string; kids: Range; of: number; k: string }) {
  return (
    <div class="flow">
      <dt>{label}</dt>
      <dd>
        <span class="bar" style={{ width: `${(100 * (kids.lo + kids.hi)) / 2 / Math.max(1, of)}%` }} />
        <Sourced k={k}>{fmtRange(kids)}</Sourced>
      </dd>
    </div>
  );
}

function ClosureReport({ c }: { c: ClosureOutcome }) {
  const of = (c.kids.lo + c.kids.hi) / 2;
  return (
    <section class="closure-report" aria-label={`Where ${nameOf(c.school)} kids went`}>
      <p>
        {nameOf(c.school)}, <Sourced k={K.enrollment}>{fmtRange(c.kids)}</Sourced> kids:
      </p>
      <dl class="flows">
        {c.receivers.map((r) => (
          <OutcomeRow key={r.school} label={nameOf(r.school)} kids={r.kids} of={of} k={K.followRate} />
        ))}
        <OutcomeRow label="Other PPS" kids={c.otherPps} of={of} k={K.nonFollowers} />
        <OutcomeRow label="Left PPS" kids={c.leftPps} of={of} k={K.nonFollowers} />
      </dl>
      {c.guess && (
        <p class={c.guess.hit ? 'call hit' : 'call'}>
          You called <Sourced k={K.callIt}>{String(c.guess.stayInPps)}</Sourced>. Stayed in PPS:{' '}
          <Sourced k={K.followRate}>{fmtRange(c.guess.actual)}</Sourced> <span class="stamp">{c.guess.hit ? 'HIT' : 'MISS'}</span>
        </p>
      )}
    </section>
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
      {report.closures.map((c) => (
        <ClosureReport key={c.school} c={c} />
      ))}
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
            <li key={h.text}>
              <Sourced k={h.sourceKey} text>
                {h.text}
              </Sourced>
            </li>
          ))}
        </ul>
      </section>
      <button type="button" class="btn primary wide" onClick={onNext}>
        Plan {report.year + 1}
      </button>
    </Window>
  );
}
