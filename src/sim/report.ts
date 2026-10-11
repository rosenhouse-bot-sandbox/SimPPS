import { fmtMoney } from '../format';
import { M } from './model';
import { SCHOOL_INFO } from './population';
import { dialSourceKey } from '../sources/model';
import type { YearFacts } from './step';
import type { BuildingFate, Dials, Headline, SeasonEvent, YearReport } from './types';

function count(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const FATE: Record<BuildingFate, string> = { mothball: 'mothballed', lease: 'leased', sell: 'sold' };

function closureEvents(f: YearFacts): SeasonEvent[] {
  if (f.closing.length === 0) return [];
  const name = (id: string) => SCHOOL_INFO.get(id)!.data.name;
  const fates = new Set(f.closing.map((c) => c.building));
  const buildings =
    fates.size === 1
      ? `${f.closing.length === 1 ? 'Its building is' : 'Their buildings are'} ${FATE[f.closing[0].building]}.`
      : `${list(f.closing.map((c) => `${name(c.school)} is ${FATE[c.building]}`))}.`;
  const sum = (pick: (t: YearFacts['closures'][number]) => number) => f.closures.reduce((a, t) => a + pick(t), 0);
  const followed = sum((t) => Object.values(t.receivers).reduce((a, n) => a + n, 0));
  const n = f.closing.length;
  return [
    {
      season: 'summer',
      title: `${n} school${n === 1 ? ' closes' : 's close'}`,
      detail: `${list(f.closing.map((c) => name(c.school)))} close. ${buildings}`,
      sourceKey: 'model.buildingFate',
    },
    {
      season: 'fall',
      title: "Closed schools' families decide",
      detail: `~${count(followed)} of ~${count(sum((t) => t.kids))} kids follow to receiving schools, ~${count(sum((t) => t.otherPps))} go to other PPS schools and ~${count(sum((t) => t.left))} leave PPS.`,
      sourceKey: 'model.followRate',
    },
  ];
}

export function seasonEvents(f: YearFacts): SeasonEvent[] {
  const cuts = f.autoCuts > 0 ? ` Automatic cuts remove ${count(f.autoCuts)} positions by seniority and spare IEP services.` : '';
  const draw = f.reserveDraw > 0 ? ` Reserves cover ${fmtMoney(f.reserveDraw)}.` : '';
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
    {
      season: 'spring',
      title: f.autoCuts > 0 ? 'June budget closes with cuts' : 'June budget closes',
      detail: `The gap is ${fmtMoney(f.plan.gap)}.${draw}${cuts}`,
      sourceKey: 'model.autoCuts',
    },
    ...closureEvents(f).filter((e) => e.season === 'summer'),
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
    ...closureEvents(f).filter((e) => e.season === 'fall'),
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
  if (f.midYearCuts > 0)
    events.push({
      season: 'winter',
      title: 'Mid-year cuts',
      detail: `Reserves fell below 3%, so ${count(f.midYearCuts)} more positions go.`,
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
  return [money, kids, where];
}

const HIGHER_IS_BETTER: Record<keyof Dials, boolean> = {
  kids: true,
  capture: true,
  kindergartenCapture: true,
  gap: true,
  positionsCut: false,
  reservePct: true,
  kidsInUrm: false,
};

/** One unit of each dial that counts as a comparable gap. */
const SCALE: Record<keyof Dials, number> = {
  kids: 100,
  capture: 0.005,
  kindergartenCapture: 0.005,
  gap: 1e6,
  positionsCut: 10,
  reservePct: 0.005,
  kidsInUrm: 100,
};

/** Dials that differ from the ghost by at least half a unit, biggest gap first. */
export function versusGhost(you: Dials, ghost: Dials): YearReport['vsGhost'] {
  return (Object.keys(HIGHER_IS_BETTER) as (keyof Dials)[])
    .filter((dial) => Math.abs(you[dial] - ghost[dial]) >= SCALE[dial] / 2)
    .map((dial) => ({
      dial,
      you: you[dial],
      ghost: ghost[dial],
      better: HIGHER_IS_BETTER[dial] ? you[dial] > ghost[dial] : you[dial] < ghost[dial],
    }))
    .sort((a, b) => Math.abs(b.you - b.ghost) / SCALE[b.dial] - Math.abs(a.you - a.ghost) / SCALE[a.dial]);
}
