import { fmtMoney } from '../format';
import { classroomsDial, M } from './model';
import { SCHOOL_INFO } from './population';
import { dialSourceKey } from '../sources/model';
import type { YearFacts } from './step';
import type { RezoneTally } from './boundaries';
import { modeledRange } from './range';
import type { BuildingFate, Dials, ElectionOutcome, Headline, RezoneOutcome, SeasonEvent, YearReport } from './types';

function count(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** A closed building's fate, as in "Its building is mothballed". */
export const FATE_DONE: Record<BuildingFate, string> = { mothball: 'mothballed', lease: 'leased', sell: 'sold' };

/** The playback names this many closed schools before counting the rest. */
const SHOWN = 3;

/** Summer names the closed buildings. Fall gives no counts: the Bulletin tells no story about a real school's families. */
function closureEvents(f: YearFacts): SeasonEvent[] {
  if (f.closing.length === 0) return [];
  const name = (id: string) => SCHOOL_INFO.get(id)!.data.name;
  const n = f.closing.length;
  const fates = new Set(f.closing.map((c) => c.building));
  const buildings =
    fates.size === 1
      ? `${n === 1 ? 'Its building is' : 'Their buildings are'} ${FATE_DONE[f.closing[0].building]}.`
      : n > SHOWN
        ? `Their buildings are ${[...fates].map((x) => FATE_DONE[x]).join(' or ')}.`
        : `${list(f.closing.map((c) => `${name(c.school)} is ${FATE_DONE[c.building]}`))}.`;
  const names = f.closing.map((c) => name(c.school));
  return [
    {
      season: 'summer',
      title: `${n} school${n === 1 ? ' closes' : 's close'}`,
      detail: `${list(n > SHOWN ? [...names.slice(0, SHOWN), `${n - SHOWN} more`] : names)} ${n === 1 ? 'closes' : 'close'}. ${buildings}`,
      sourceKey: 'model.buildingFate',
    },
    {
      season: 'fall',
      title: `Families of the closed school${n === 1 ? '' : 's'} decide`,
      detail: 'Their kids choose new schools. The report shows where they went.',
      sourceKey: 'model.followRate',
    },
  ];
}

/** Summer names the converted schools and their receivers. */
function conversionEvents(f: YearFacts): SeasonEvent[] {
  const n = f.converting.length;
  if (n === 0) return [];
  const name = (id: string) => SCHOOL_INFO.get(id)!.data.name;
  const sends = f.converting.map((c) => `${name(c.school)} sends grades 6–8 to ${name(c.to)}`);
  return [
    {
      season: 'summer',
      title: n === 1 ? `${name(f.converting[0].school)} becomes K-5` : `${n} K-8s become K-5`,
      detail: `${list(n > SHOWN ? [...sends.slice(0, SHOWN), `${n - SHOWN} more change`] : sends)}.`,
      sourceKey: 'model.gradeSpan',
    },
    {
      season: 'fall',
      title: 'Middle graders decide',
      detail: 'Kids whose K-8 became K-5 choose schools. The report shows where they went.',
      sourceKey: 'model.gradeSpan',
    },
  ];
}

/** Summer names each moved DLI program and its schools. */
function programEvents(f: YearFacts): SeasonEvent[] {
  const n = f.programMoves.length;
  if (n === 0) return [];
  const name = (id: string) => SCHOOL_INFO.get(id)!.data.name;
  const moves = f.programMoves.map((m) =>
    m.joins ? `${list(m.from.map(name))}'s ${m.program} DLI joins ${name(m.to)}'s.` : `${m.program} leaves ${list(m.from.map(name))} for ${name(m.to)}.`,
  );
  const closing = new Set(f.closing.map((c) => c.school));
  const fromClosing = f.programMoves.filter((m) => m.from.every((s) => closing.has(s))).length;
  const choices =
    fromClosing === n ? 'or move with their closing school' : fromClosing === 0 ? 'or stay without them' : 'or stay without them where their school stays open';
  const [first] = f.programMoves;
  return [
    {
      season: 'summer',
      title: n === 1 ? `${first.program} DLI moves to ${name(first.to)}` : `${n} DLI programs move`,
      detail: [...moves.slice(0, SHOWN), ...(n > SHOWN ? [`${n - SHOWN} more move.`] : [])].join(' '),
      sourceKey: 'model.programMove',
    },
    {
      season: 'fall',
      title: 'DLI families decide',
      detail: `Kids in moved programs follow them ${choices}. The report shows where they went.`,
      sourceKey: 'model.programMove',
    },
  ];
}

/** Boundary events name no school and give no counts of a school's families. */
function boundaryEvents(f: YearFacts): SeasonEvent[] {
  const { elementary, middle } = f.rezonedCells;
  const n = elementary + middle;
  if (n === 0) return [];
  const entrants = [elementary > 0 && 'kindergartners', middle > 0 && '6th graders'].filter(Boolean).join(' and ');
  const who = {
    all: `Current students keep their schools; new ${entrants} use the new zones.`,
    some: 'Some current students get new zone schools; the rest keep theirs.',
    none: 'Kids in them get new zone schools.',
  }[f.grandfathered];
  return [
    {
      season: 'summer',
      title: 'Boundaries change',
      detail: `${count(n)} block${n === 1 ? '' : 's'} of 250 m change${n === 1 ? 's' : ''} zones. ${who}`,
      sourceKey: 'model.zoneGrid',
    },
    ...(f.rezoned.kids > 0
      ? [
          {
            season: 'fall' as const,
            title: 'Re-zoned families decide',
            detail: 'Kids whose zone school changed choose schools. The report shows where they went.',
            sourceKey: 'model.sliceStay',
          },
        ]
      : []),
  ];
}

const yesPct = (e: ElectionOutcome) => pct(e.yes);

/** The vote's citywide total. It names no school. */
function electionEvent(e: ElectionOutcome): SeasonEvent {
  const title = e.passed
    ? e.renewal && e.rate === M.levyRate
      ? `Voters renew the levy: ${yesPct(e)} yes`
      : `Voters approve a $${e.rate.toFixed(2)} levy: ${yesPct(e)} yes`
    : `Levy fails: ${yesPct(e)} yes`;
  const from = e.when === 'may' ? 'this fall' : 'next fall';
  const detail = e.passed
    ? `It runs ${M.levyYears} years from ${from}.`
    : e.when === 'november'
      ? 'It can run again in May.'
      : e.renewal
        ? 'The levy expires, so the June budget loses its revenue.'
        : "Today's levy stays in force.";
  return { season: e.when === 'may' ? 'spring' : 'winter', title, detail, sourceKey: 'model.election' };
}

const points = (n: number) => `${n} point${n === 1 ? '' : 's'}`;

/** Names regions only. */
function trustEvent({ before, after, fell, strain }: YearFacts['trust']): SeasonEvent {
  const to = Math.round(after);
  const cuts = Math.round(strain.cuts);
  const classes = Math.round(strain.classes);
  const causes = [
    cuts > 0 && `Cuts cost every region ${points(cuts)}.`,
    classes > 0 && `A larger K-5 class size costs every region ${points(classes)}.`,
    classes < 0 && `A smaller K-5 class size wins back ${points(-classes)} in every region.`,
    strain.calmGain < M.trustCalmYear && `K-5 classes above ${M.baseClassSize} hold back the calm-year gain.`,
    fell.length > 0 && `Closures and second moves cost trust in ${list(fell)}.`,
  ].filter(Boolean);
  return {
    season: 'winter',
    title: to === Math.round(before) ? `Family trust holds at ${to}` : `Family trust ${after < before ? 'falls' : 'rises'} to ${to}`,
    detail: causes.join(' ') || 'No forced moves cost trust.',
    sourceKey: 'model.trust',
  };
}

export function seasonEvents(f: YearFacts): SeasonEvent[] {
  const cuts = f.autoCuts > 0 ? ` Automatic cuts remove ${count(f.autoCuts)} positions by seniority and spare IEP services.` : '';
  const draw = f.reserveDraw > 0 ? ` Reserves cover ${fmtMoney(f.reserveDraw)}.` : '';
  const oneTime = f.plan.oneTimeDraw ? ` Reserves pay ${fmtMoney(f.plan.oneTimeDraw)} of closures' one-time costs.` : '';
  const rehired = f.plan.rehired ? ` The surplus rehires ${count(f.plan.rehired)} cut positions.` : '';
  const [closes, decide] = closureEvents(f);
  const [rezone, rezonedDecide] = boundaryEvents(f);
  const [convert, convertedDecide] = conversionEvents(f);
  const [program, programDecide] = programEvents(f);
  const vote = f.election ? electionEvent(f.election) : null;
  const events: SeasonEvent[] = [
    {
      season: 'spring',
      title: 'Kindergarten lottery',
      detail: `~${count(f.kEnrolled)} of ~${count(f.kResidents)} resident kindergartners choose PPS (~${pct(f.kEnrolled / f.kResidents)}).`,
      sourceKey: 'model.kCapture',
    },
    ...(f.stateFundingGrowth === null
      ? []
      : [
          {
            season: 'spring' as const,
            title: `Legislature sets state funding: +${(f.stateFundingGrowth * 100).toFixed(1)}%`,
            detail: 'The 2-year state school budget sets revenue for this year and next.',
            sourceKey: 'model.stateFunding',
          },
        ]),
    ...(vote?.season === 'spring' ? [vote] : []),
    {
      season: 'spring',
      title: f.autoCuts > 0 ? 'June budget closes with cuts' : 'June budget closes',
      detail: `The gap is ${fmtMoney(f.plan.gap)}.${draw}${oneTime}${cuts}${rehired}`,
      sourceKey: 'model.autoCuts',
    },
    ...(closes ? [closes] : []),
    ...(convert ? [convert] : []),
    ...(program ? [program] : []),
    ...(rezone ? [rezone] : []),
    {
      season: 'summer',
      title: 'Eighth graders move on',
      detail: `${count(f.graduates)} leave for high school.`,
      sourceKey: 'model.graduates',
    },
    {
      season: 'fall',
      title: 'Families decide',
      detail: `~${count(f.flows.leftPps)} kids left PPS, ~${count(f.flows.cameBack)} came back and ~${count(f.flows.movedWithinPps)} changed schools.`,
      sourceKey: 'model.movingRoll',
    },
    ...(decide ? [decide] : []),
    ...(convertedDecide ? [convertedDecide] : []),
    ...(programDecide ? [programDecide] : []),
    ...(rezonedDecide ? [rezonedDecide] : []),
    {
      season: 'october',
      title: 'Classes form',
      detail: `~${count(f.blended)} of ~${count(f.k5Homerooms)} K-5 homerooms are blended.${f.homeroomsCut > 0 ? ` Cuts have taken ~${count(f.homeroomsCut)} homerooms, so classes run larger.` : ''} ${count(f.crowded)} schools are over capacity.`,
      sourceKey: 'model.homerooms',
    },
    {
      season: 'winter',
      title: 'Costs land',
      detail: `Costs rise ${(M.costGrowth * 100).toFixed(1)}% a year.`,
      sourceKey: 'model.costGrowth',
    },
  ];
  events.push(trustEvent(f.trust));
  if (vote?.season === 'winter') events.push(vote);
  if (f.midYearCuts > 0)
    events.push({
      season: 'winter',
      title: 'Mid-year cuts',
      detail: `Reserves fell below ${pct(M.midYearFloor)}, so ${count(f.midYearCuts)} more positions go.`,
      sourceKey: 'model.midYearCuts',
    });
  return events;
}

/** Headlines about totals and regions. They never name a school. */
export function headlines(f: YearFacts, before: Dials, after: Dials): Headline[] {
  const cut = f.autoCuts + f.midYearCuts;
  const money: Headline =
    cut > 0
      ? { text: `Cuts reach every school: ${count(cut)} positions`, sourceKey: 'model.autoCuts' }
      : f.reserveDraw > 0
        ? { text: 'Reserves cover the gap', sourceKey: 'model.reserves' }
        : { text: 'Budget balances without cuts', sourceKey: dialSourceKey('gap') };
  const kids: Headline = {
    text: `Enrollment ${after.kids < before.kids ? 'falls' : 'rises'} to ~${count(after.kids)}`,
    sourceKey: dialSourceKey('kids'),
  };
  const rates = [...f.regions]
    .filter(([, r]) => r.kids > 0)
    .map(([name, r]) => [name, r.leavers / r.kids] as const)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [region, rate] = rates[0] ?? [];
  const where: Headline = {
    text: region && rate ? `Leavers run highest in ${region}: ~${(rate * 100).toFixed(1)}%` : 'No region loses kids',
    sourceKey: 'model.movingRoll',
  };
  const vote: Headline[] = f.election
    ? [
        {
          text: f.election.passed
            ? `Voters ${f.election.renewal && f.election.rate === M.levyRate ? 'renew the levy' : `approve a $${f.election.rate.toFixed(2)} levy`} with ${yesPct(f.election)} yes`
            : `Levy fails with ${yesPct(f.election)} yes`,
          sourceKey: 'model.election',
        },
      ]
    : [];
  return [...vote, money, kids, where];
}

/** The report's "where kids went" for kids a boundary change moved, as ranges. */
export function rezoneOutcome(t: RezoneTally): RezoneOutcome {
  return {
    kids: modeledRange(t.kids),
    zoneSchool: modeledRange(t.arrived),
    otherPps: modeledRange(t.otherPps),
    leftPps: modeledRange(t.left),
  };
}

const HIGHER_IS_BETTER: Record<keyof Dials, boolean> = {
  walkK5: true,
  newBusRiders: false,
  kids: true,
  capture: true,
  kindergartenCapture: true,
  gap: true,
  positionsCut: false,
  reservePct: true,
  kidsInUrm: false,
  trust: true,
  k5Class: false,
};

/** One unit of each dial that counts as a comparable gap. */
const SCALE: Record<keyof Dials, number> = {
  walkK5: 100,
  newBusRiders: 20,
  kids: 100,
  capture: 0.005,
  kindergartenCapture: 0.005,
  gap: 1e6,
  positionsCut: 10,
  reservePct: 0.005,
  kidsInUrm: 100,
  trust: 1,
  k5Class: 0.2,
};

/** The Classrooms dial counts kids, so more is better. */
const higherIsBetter = (dial: keyof Dials) => HIGHER_IS_BETTER[dial] || (dial === 'k5Class' && classroomsDial());
const scale = (dial: keyof Dials) => (dial === 'k5Class' && classroomsDial() ? SCALE.kids : SCALE[dial]);

/** Dials that differ from the ghost by at least half a unit, biggest gap first. */
export function versusGhost(you: Dials, ghost: Dials): YearReport['vsGhost'] {
  return (Object.keys(HIGHER_IS_BETTER) as (keyof Dials)[])
    .filter((dial) => Math.abs(you[dial] - ghost[dial]) >= scale(dial) / 2)
    .map((dial) => ({
      dial,
      you: you[dial],
      ghost: ghost[dial],
      better: higherIsBetter(dial) ? you[dial] > ghost[dial] : you[dial] < ghost[dial],
    }))
    .sort((a, b) => Math.abs(b.you - b.ghost) / scale(b.dial) - Math.abs(a.you - a.ghost) / scale(a.dial));
}
