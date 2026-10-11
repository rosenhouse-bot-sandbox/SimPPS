import rightsizing from '../data/rightsizing.json';
import type { Closure, SchoolId } from './types';

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

type Published = (typeof rightsizing.scenarios)['A'];

function closuresOf(s: Published): Closure[] {
  return s.closing.map((name) => {
    const r = RECEIVERS[name];
    if (!r) throw new Error(`No receivers for ${name}`);
    return { school: r.id, receivers: r.to.map(([school, share]) => ({ school, share })), building: 'mothball' };
  });
}

function notModeled(s: Published): string {
  return `Not modeled yet: ${s.grade_changes_count} grade-span changes, ${s.program_moves_count} program moves and ${s.boundary_changes_count} boundary changes.`;
}

export const SCENARIOS: Record<Start, { label: string; closures: Closure[]; notModeled: string | null }> = {
  'status-quo': { label: 'Status quo 2026', closures: [], notModeled: null },
  'scenario-a': { label: 'PPS Scenario A', closures: closuresOf(rightsizing.scenarios.A), notModeled: notModeled(rightsizing.scenarios.A) },
  'scenario-b': { label: 'PPS Scenario B', closures: closuresOf(rightsizing.scenarios.B), notModeled: notModeled(rightsizing.scenarios.B) },
};
