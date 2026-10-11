import type { ClosureOutcome, Dials, ElectionOutcome, Flows, Range, RezoneOutcome, YearReport } from '../sim/types';
import { RevealSheet } from './RevealSheet';
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
  walkK5: 'K-5 walkers',
  newBusRiders: 'New bus riders',
  trust: 'Trust',
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

function RezoneReport({ r }: { r: RezoneOutcome }) {
  const of = (r.kids.lo + r.kids.hi) / 2;
  return (
    <section class="closure-report" aria-label="Where re-zoned kids went">
      <p>
        Re-zoned, <Sourced k={K.sliceStay}>{fmtRange(r.kids)}</Sourced> kids:
      </p>
      <dl class="flows">
        <OutcomeRow label="New zone school" kids={r.zoneSchool} of={of} k={K.sliceStay} />
        <OutcomeRow label="Other PPS school" kids={r.otherPps} of={of} k={K.nonFollowers} />
        <OutcomeRow label="Left PPS" kids={r.leftPps} of={of} k={K.nonFollowers} />
      </dl>
    </section>
  );
}

function VoteRow({ who, e }: { who: string; e: ElectionOutcome }) {
  return (
    <li class={e.passed ? 'call hit' : 'call'}>
      {`${who}: $${e.rate.toFixed(2)}, `}
      <Sourced k={K.election}>{`${Math.round(e.yes * 100)}%~`}</Sourced> yes{' '}
      <span class="stamp">{e.passed ? 'PASSED' : 'FAILED'}</span>
    </li>
  );
}

/** Citywide totals only. */
function LevyVote({ you, ghost }: { you?: ElectionOutcome; ghost?: ElectionOutcome }) {
  return (
    <section class="levy-vote" aria-label="Levy vote">
      <h3>Levy vote</h3>
      <ul class="ghost">
        {you && <VoteRow who="You" e={you} />}
        {ghost && <VoteRow who="Ghost" e={ghost} />}
      </ul>
    </section>
  );
}

/** The ghost list shows the three largest gaps, and the Walk dials whenever they differ. */
const ALWAYS: (keyof Dials)[] = ['walkK5', 'newBusRiders'];

interface ReportProps {
  report: YearReport;
  turn: number;
  onNext: () => void;
  /** K-5 walkers before and after a year with boundary edits. */
  walk?: { before: number; after: number };
}

export function ReportView({ report, turn, onNext, walk }: ReportProps) {
  return (
    <Window title={`DEC ${report.year} · YEAR ${turn}`} class="panel report">
      {report.reveals.map((r) => (
        <RevealSheet key={r.sourceKey} reveal={r} />
      ))}
      <h3>Where kids went</h3>
      {report.closures.map((c) => (
        <ClosureReport key={c.school} c={c} />
      ))}
      {report.rezoned && <RezoneReport r={report.rezoned} />}
      {walk && (
        <p>
          {DIAL_NAMES.walkK5}{' '}
          <Sourced k={K.walkK5} modeled>{`${exact(walk.before)} → ${exact(walk.after)}`}</Sourced>
        </p>
      )}
      <WhereKidsWent flows={report.flows} />
      {(report.election || report.ghostElection) && <LevyVote you={report.election} ghost={report.ghostElection} />}
      <h3>Vs. do-nothing ghost</h3>
      {report.vsGhost.length === 0 && <p class="note">No difference yet.</p>}
      <ul class="ghost">
        {report.vsGhost.filter((g, i) => i < 3 || ALWAYS.includes(g.dial)).map((g) => (
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
