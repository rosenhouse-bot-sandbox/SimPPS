import type { ComponentChildren } from 'preact';
import type { ClosureOutcome, ConversionOutcome, Dials, ElectionOutcome, Flows, ModelOverrides, ProgramMoveOutcome, Range, RezoneOutcome, YearReport } from '../sim/types';
import { RevealSheet } from './RevealSheet';
import { defaultValue } from '../sim/model';
import { paramInfo } from '../sources/params';
import { fmtMoney, fmtPct, fmtRange } from '../format';
import { nameOf } from './closeSend';
import { Sourced } from './Sourced';
import { K } from './sources';
import type { GlossaryTerm, PlainLabel } from './glossary';
import { Label, Term } from './Term';
import { Window } from './Window';

type FlowRow = { label: GlossaryTerm | PlainLabel; n: (f: Flows) => number; k: string; total?: boolean };

const IN_PPS: FlowRow[] = [
  { label: 'Stayed', n: (f) => f.stayed, k: K.flows },
  { label: 'Moved in PPS', n: (f) => f.movedWithinPps, k: K.flows },
  { label: 'Came back', n: (f) => f.cameBack, k: K.flows },
  { label: 'New kindergartners', n: (f) => f.enteredK, k: K.kCapture },
];

const FLOW_ROWS: FlowRow[] = [
  ...IN_PPS,
  { label: 'Kids now', n: (f) => IN_PPS.reduce((a, r) => a + r.n(f), 0), k: K.kids, total: true },
  { label: 'Left PPS', n: (f) => f.leftPps, k: K.flows },
  { label: 'To high school', n: (f) => f.graduated, k: K.graduates },
];

const DIAL_TERMS: Record<keyof Dials, GlossaryTerm> = {
  kids: 'Kids',
  capture: 'Capture',
  kindergartenCapture: 'Kindergarten capture',
  gap: 'Gap',
  positionsCut: 'Positions cut',
  reservePct: 'Reserves',
  kidsInUrm: 'Kids in URM',
  walkK5: 'K-5 walkers',
  newBusRiders: 'New bus riders',
  trust: 'Trust',
  k5Class: 'Avg K-5 class',
  classrooms: 'Classrooms',
};

const SHORT: Partial<Record<keyof Dials, string>> = { kindergartenCapture: 'K capture' };

function DialName({ dial }: { dial: keyof Dials }) {
  return <Term t={DIAL_TERMS[dial]}>{SHORT[dial]}</Term>;
}

function exact(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtDial(dial: keyof Dials, v: number): string {
  if (dial === 'gap') return fmtMoney(v);
  if (dial === 'k5Class') return v.toFixed(1);
  if (dial === 'capture' || dial === 'kindergartenCapture' || dial === 'reservePct') return fmtPct(v);
  return exact(v);
}

function WhereKidsWent({ flows }: { flows: Flows }) {
  const max = Math.max(1, ...FLOW_ROWS.map((r) => r.n(flows)));
  return (
    <dl class="flows">
      {FLOW_ROWS.map((r) => (
        <div key={r.label} class={r.total ? 'flow total' : 'flow'}>
          <dt>
            <Label t={r.label} />
          </dt>
          <dd>
            <span class="bar" style={{ width: `${(100 * r.n(flows)) / max}%` }} />
            <Sourced k={r.k} modeled>
              {exact(r.n(flows))}
            </Sourced>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function OutcomeRow({ label, kids, of, k }: { label: ComponentChildren; kids: Range; of: number; k: string }) {
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
        <OutcomeRow label={<Term t="Other PPS" />} kids={c.otherPps} of={of} k={K.nonFollowers} />
        <OutcomeRow label={<Term t="Left PPS" />} kids={c.leftPps} of={of} k={K.nonFollowers} />
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

function ConversionReport({ c }: { c: ConversionOutcome }) {
  const of = (c.kids.lo + c.kids.hi) / 2;
  const name = `${nameOf(c.school)} 6–8`;
  return (
    <section class="closure-report" aria-label={`Where ${name} went`}>
      <p>
        {name}, <Sourced k={K.gradeSpan}>{fmtRange(c.kids)}</Sourced> kids:
      </p>
      <dl class="flows">
        <OutcomeRow label={nameOf(c.to)} kids={c.receiver} of={of} k={K.gradeSpan} />
        <OutcomeRow label="Other PPS" kids={c.otherPps} of={of} k={K.nonFollowers} />
        <OutcomeRow label="Left PPS" kids={c.leftPps} of={of} k={K.nonFollowers} />
      </dl>
    </section>
  );
}

const list = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

function ProgramMoveReport({ m }: { m: ProgramMoveOutcome }) {
  const of = (m.kids.lo + m.kids.hi) / 2;
  return (
    <section class="closure-report" aria-label={`Who kept ${list(m.from.map(nameOf))}'s ${m.program} DLI`}>
      <p>
        Who kept {m.program} DLI from {list(m.from.map(nameOf))}, of <Sourced k={K.programMove}>{fmtRange(m.kids)}</Sourced> kids:
      </p>
      <dl class="flows">
        <OutcomeRow label={nameOf(m.to)} kids={m.receiver} of={of} k={K.programMove} />
        <OutcomeRow label={<Term t="Left DLI" />} kids={m.leftDli} of={of} k={K.programMove} />
        <OutcomeRow label={<Term t="Left PPS" />} kids={m.leftPps} of={of} k={K.programMove} />
      </dl>
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
        <OutcomeRow label={<Term t="New zone school" />} kids={r.zoneSchool} of={of} k={K.sliceStay} />
        <OutcomeRow label={<Term t="Other PPS">Other PPS school</Term>} kids={r.otherPps} of={of} k={K.nonFollowers} />
        <OutcomeRow label={<Term t="Left PPS" />} kids={r.leftPps} of={of} k={K.nonFollowers} />
      </dl>
    </section>
  );
}

function VoteRow({ who, e }: { who: string; e: ElectionOutcome }) {
  return (
    <li class={e.passed ? 'call hit' : 'call'}>
      {`${who}: `}
      <Sourced k={K.levyRate}>{`$${e.rate.toFixed(2)}`}</Sourced>
      {', '}
      <Sourced k={K.election}>{`${Math.round(e.yes * 100)}%~`}</Sourced> yes{' '}
      <span class="stamp">{e.passed ? 'PASSED' : 'FAILED'}</span>
    </li>
  );
}

/** Citywide totals only. */
function LevyVote({ you, ghost }: { you?: ElectionOutcome; ghost?: ElectionOutcome }) {
  return (
    <section class="levy-vote" aria-label="Levy vote">
      <h3>
        <Term t="Levy vote" />
      </h3>
      <ul class="ghost">
        {you ? <VoteRow who="You" e={you} /> : <li>You had no levy vote this year.</li>}
        {ghost && <VoteRow who="Ghost" e={ghost} />}
      </ul>
    </section>
  );
}

/** The ghost list shows the three largest gaps, and the Walk and class dials whenever they differ. */
const ALWAYS: (keyof Dials)[] = ['walkK5', 'newBusRiders', 'k5Class'];

interface ReportProps {
  report: YearReport;
  turn: number;
  onNext: () => void;
  /** K-5 walkers before and after a year with boundary edits. */
  walk?: { before: number; after: number };
  /** The game's changed model parameters. */
  model?: ModelOverrides;
}

const RANGE_END: Record<string, string> = { lo: ' (low)', hi: ' (high)' };

function paramName(path: string): string {
  return paramInfo(path).label + (RANGE_END[path.split('.')[1]] ?? '');
}

export function ReportView({ report, turn, onNext, walk, model = {} }: ReportProps) {
  const changed = Object.entries(model);
  return (
    <Window title={`DEC ${report.year} · YEAR ${turn}`} class="panel report">
      {changed.length > 0 && (
        <details class="badge model-changed">
          <summary>{`Changed model: ${changed.length} parameter${changed.length === 1 ? '' : 's'}`}</summary>
          <ul>
            {changed.map(([path, v]) => (
              <li key={path}>{`${paramName(path)}: ${v}, default ${defaultValue(path)}`}</li>
            ))}
          </ul>
        </details>
      )}
      <h3>
        <Term t="Where kids went" />
      </h3>
      {report.closures.map((c) => (
        <ClosureReport key={c.school} c={c} />
      ))}
      {report.conversions.map((c) => (
        <ConversionReport key={c.school} c={c} />
      ))}
      {report.programMoves.map((m) => (
        <ProgramMoveReport key={`${m.program} ${m.from.join()}`} m={m} />
      ))}
      {report.rezoned && <RezoneReport r={report.rezoned} />}
      {walk && (
        <p>
          <DialName dial="walkK5" />{' '}
          <Sourced k={K.walkK5} modeled>{`${exact(walk.before)} → ${exact(walk.after)}`}</Sourced>
        </p>
      )}
      <WhereKidsWent flows={report.flows} />
      {(report.election || report.ghostElection) && <LevyVote you={report.election} ghost={report.ghostElection} />}
      <h3>
        Vs. <Term t="Do-nothing ghost">do-nothing ghost</Term>
      </h3>
      {report.vsGhost.length === 0 && <p class="note">No difference yet.</p>}
      <ul class="ghost">
        {report.vsGhost.filter((g, i) => i < 3 || ALWAYS.includes(g.dial)).map((g) => (
          <li key={g.dial}>
            <span aria-label={g.better ? 'better' : 'worse'}>{g.better ? '▲' : '▼'}</span> <DialName dial={g.dial} />{' '}
            <Sourced k={K.ghost} modeled>
              {`${fmtDial(g.dial, g.you)} vs ${fmtDial(g.dial, g.ghost)}`}
            </Sourced>
          </li>
        ))}
      </ul>
      <section class="bulletin" aria-label="The Bulletin">
        <h3>
          <Term t="The Bulletin" /> <span class="stamp">SIMULATION</span>
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
      {report.reveals.map((r) => (
        <RevealSheet key={r.sourceKey} reveal={r} />
      ))}
      <button type="button" class="btn primary wide" onClick={onNext}>
        Plan {report.year + 1}
      </button>
    </Window>
  );
}
