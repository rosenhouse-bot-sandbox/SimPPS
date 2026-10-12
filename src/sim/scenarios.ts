import rightsizing from '../data/rightsizing.json';
import type { Closure, GradeSpanChange, SchoolId } from './types';

export type Start = 'status-quo' | 'scenario-a' | 'scenario-b';

/**
 * model.scenarios: receivers from PPS's Rightsizing deck. Sellwood MS's split is unpublished, so it is
 * even. Irvington's 6-8 receiver (Beaumont) is left out because Irvington serves K-5. DLI and
 * Deaf/HH program moves are later levers.
 */
const RECEIVERS: Record<string, { id: SchoolId; to: [SchoolId, number][] }> = {
  Beach: { id: 'beach', to: [['chief-joseph', 1]] },
  Buckman: { id: 'buckman', to: [['abernethy', 0.5], ['sunnyside-environmental', 0.5]] },
  Creston: { id: 'creston', to: [['atkinson', 1]] },
  Irvington: { id: 'irvington', to: [['beverly-cleary', 1]] },
  'James John': { id: 'james-john', to: [['sitton', 1]] },
  Lewis: { id: 'lewis', to: [['duniway', 1]] },
  Maplewood: { id: 'maplewood', to: [['hayhurst', 0.7], ['rieke', 0.3]] },
  Marysville: { id: 'marysville', to: [['arleta', 1]] },
  Peninsula: { id: 'peninsula', to: [['rosa-parks', 1]] },
  'Rose City Park': { id: 'rose-city-park', to: [['scott', 1]] },
  Sabin: { id: 'sabin', to: [['dr-martin-luther-king-jr', 1]] },
  'Sellwood MS': { id: 'sellwood', to: [['hosford', 0.5], ['lane', 0.5]] },
  Stephenson: { id: 'stephenson', to: [['markham', 0.7], ['capitol-hill', 0.3]] },
  Woodmere: { id: 'woodmere', to: [['whitman', 1]] },
};

/** model.scenarios: each K-8 that sends grades 6-8 to a middle school. */
const GRADE_CHANGES: Record<string, GradeSpanChange> = {
  'Beverly Cleary': { school: 'beverly-cleary', to: 'beaumont' },
  Laurelhurst: { school: 'laurelhurst', to: 'mt-tabor' },
  'Bridger Creative Science': { school: 'bridger-creative-science', to: 'harrison-park' },
  'Sunnyside Environmental': { school: 'sunnyside-environmental', to: 'hosford' },
  Faubion: { school: 'faubion', to: 'ockley-green' },
  Vernon: { school: 'vernon', to: 'harriet-tubman' },
  Chavez: { school: 'cesar-chavez', to: 'george' },
};

type Published = (typeof rightsizing.scenarios)['A'];

function closuresOf(s: Published): Closure[] {
  return s.closing.map((name) => {
    const r = RECEIVERS[name];
    if (!r) throw new Error(`No receivers for ${name}`);
    return { school: r.id, receivers: r.to.map(([school, share]) => ({ school, share })), building: 'mothball' };
  });
}

/** "MLC becomes K-8" changes only its high school, outside the simulation. */
function gradeChangesOf(s: Published): GradeSpanChange[] {
  return s.grade_changes.flatMap((g) => {
    if (g.grades !== '6-8') return [];
    const change = GRADE_CHANGES[g.from];
    if (!change) throw new Error(`No grade-span change for ${g.from}`);
    return [change];
  });
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

function notModeled(s: Published): string {
  const spans = s.grade_changes_count - gradeChangesOf(s).length;
  return `Not modeled yet: ${plural(spans, 'grade-span change')}, ${plural(s.program_moves_count, 'program move')} and ${plural(s.boundary_changes_count, 'boundary change')}.`;
}

function scenario(label: string, s: Published) {
  return { label, closures: closuresOf(s), gradeChanges: gradeChangesOf(s), notModeled: notModeled(s) };
}

export const SCENARIOS: Record<Start, { label: string; closures: Closure[]; gradeChanges: GradeSpanChange[]; notModeled: string | null }> = {
  'status-quo': { label: 'Status quo 2026', closures: [], gradeChanges: [], notModeled: null },
  'scenario-a': scenario('PPS Scenario A', rightsizing.scenarios.A),
  'scenario-b': scenario('PPS Scenario B', rightsizing.scenarios.B),
};
