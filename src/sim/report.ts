import { M } from './model';
import type { YearFacts } from './step';
import type { Dials, SeasonEvent, YearReport } from './types';

export function money(dollars: number): string {
  const sign = dollars < 0 ? '-' : '';
  return `${sign}$${(Math.abs(dollars) / 1e6).toFixed(1)}M`;
}

function count(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function seasonEvents(f: YearFacts): SeasonEvent[] {
  const cuts = f.autoCuts > 0 ? ` Automatic cuts remove ${count(f.autoCuts)} positions by seniority and spare IEP services.` : '';
  const draw = f.reserveDraw > 0 ? ` Reserves cover ${money(f.reserveDraw)}.` : '';
  const events: SeasonEvent[] = [
    {
      season: 'spring',
      title: 'Kindergarten lottery',
      detail: `~${count(f.kEnrolled)} of ~${count(f.kResidents)} resident kindergartners choose PPS (~${pct(f.kEnrolled / f.kResidents)}).`,
      sourceKey: 'model.kCapture',
    },
    {
      season: 'spring',
      title: 'State funding flat',
      detail: 'The state holds school funding flat.',
      sourceKey: 'model.stateFunding',
    },
    {
      season: 'spring',
      title: f.autoCuts > 0 ? 'June budget closes with cuts' : 'June budget closes',
      detail: `The gap is ${money(f.plan.gap)}.${draw}${cuts}`,
      sourceKey: 'model.autoCuts',
    },
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

/** Headlines about totals and regions only. They never name a school. */
export function headlines(f: YearFacts, before: Dials, after: Dials): string[] {
  const cut = f.autoCuts + f.midYearCuts;
  const money =
    cut > 0
      ? `Cuts reach every school: ${count(cut)} positions`
      : f.reserveDraw > 0
        ? 'Reserves cover the gap'
        : 'Budget balances without cuts';
  const kids = `Enrollment ${after.kids < before.kids ? 'falls' : 'rises'} to ~${count(after.kids)}`;
  const [region, n] = [...f.leaversByRegion].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
  const where = region ? `Most leavers live in the ${region} area: ~${count(n)} kids` : 'No region loses kids';
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

export function versusGhost(you: Dials, ghost: Dials): YearReport['vsGhost'] {
  return (Object.keys(HIGHER_IS_BETTER) as (keyof Dials)[])
    .map((dial) => ({
      dial,
      you: you[dial],
      ghost: ghost[dial],
      better: HIGHER_IS_BETTER[dial] ? you[dial] > ghost[dial] : you[dial] < ghost[dial],
    }))
    .sort((a, b) => Math.abs(b.you - b.ghost) / SCALE[b.dial] - Math.abs(a.you - a.ghost) / SCALE[a.dial]);
}
