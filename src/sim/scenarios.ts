import rightsizing from '../data/rightsizing.json';
import type { Closure, GradeSpanChange, ProgramMove, SchoolId } from './types';

export type Start = 'status-quo' | 'scenario-a' | 'scenario-b';

/**
 * model.scenarios: receivers from PPS's Rightsizing deck. Sellwood MS's split is unpublished, so it is
 * even. Irvington's 6-8 receiver (Beaumont) is left out because Irvington serves K-5.
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

/**
 * model.scenarios: each DLI program move, by PPS's wording; a move naming no program moves its
 * school's only one. Chavez 6–8's Spanish kids go to George with Chavez's grade-span change. Null
 * moves have no student counts in the data.
 */
const PROGRAM_MOVES: Record<string, ProgramMove | null> = {
  'Spanish: Beach, James John, and Sitton to Cesar Chavez': { program: 'Spanish', from: ['beach', 'james-john', 'sitton'], to: 'cesar-chavez' },
  'Atkinson to Lent': { program: 'Spanish', from: ['atkinson'], to: 'lent' },
  'Scott to Rigler': { program: 'Spanish', from: ['scott'], to: 'rigler' },
  'Beaumont MS to Roseway Heights MS': { program: 'Spanish', from: ['beaumont'], to: 'roseway-heights' },
  'Chavez 6–8 and Ockley Green MS to George MS': { program: 'Spanish', from: ['ockley-green'], to: 'george' },
  'Vietnamese: Rose City Park to Vestal': { program: 'Vietnamese', from: ['rose-city-park'], to: 'vestal' },
  'Mandarin: Clark to Woodstock': { program: 'Mandarin', from: ['clark'], to: 'woodstock' },
  'MLK Jr. to Boise-Eliot/Humboldt': { program: 'Mandarin', from: ['dr-martin-luther-king-jr'], to: 'boise-eliot' },
  'Creston Deaf and Hard of Hearing to Glencoe': null,
  'Odyssey moves to the MLC site': null,
};

type Published = (typeof rightsizing.scenarios)['A'];

function programMove(text: string): ProgramMove | null {
  if (!(text in PROGRAM_MOVES)) throw new Error(`No program move for ${text}`);
  return PROGRAM_MOVES[text];
}

function programMovesOf(s: Published): ProgramMove[] {
  return s.program_moves.flatMap((m) => programMove(m.text) ?? []);
}

function closuresOf(s: Published): Closure[] {
  return s.closing.map((name) => {
    const r = RECEIVERS[name];
    if (!r) throw new Error(`No receivers for ${name}`);
    return { school: r.id, receivers: r.to.map(([school, share]) => ({ school, share })), building: 'mothball' };
  });
}

/** The 6-8 moves. MLC also "becomes K-8", but it already serves K-8 here and only its high school closes, outside the simulation. */
function gradeChangesOf(s: Published): GradeSpanChange[] {
  return s.grade_changes.flatMap((g) => {
    if (g.grades !== '6-8') return [];
    const change = GRADE_CHANGES[g.from];
    if (!change) throw new Error(`No grade-span change for ${g.from}`);
    return [change];
  });
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** PPS counts a program move once per school it leaves. */
function programMoveCount(s: Published, modeled: boolean): number {
  return s.program_moves.filter((m) => !!programMove(m.text) === modeled).reduce((n, m) => n + m.from.length, 0);
}

function notModeled(s: Published): string {
  const spans = s.grade_changes_count - gradeChangesOf(s).length;
  const programs = programMoveCount(s, false);
  return `Not modeled yet: ${plural(spans, 'grade-span change')}, ${plural(programs, 'program move')} and ${plural(s.boundary_changes_count, 'boundary change')}.`;
}

function scenario(label: string, s: Published) {
  return {
    label,
    closures: closuresOf(s),
    gradeChanges: gradeChangesOf(s),
    programMoves: programMovesOf(s),
    programMoveCount: programMoveCount(s, true),
    notModeled: notModeled(s),
  };
}

export interface Scenario {
  label: string;
  closures: Closure[];
  gradeChanges: GradeSpanChange[];
  programMoves: ProgramMove[];
  /** Modeled program moves, counted per school left as PPS does. */
  programMoveCount: number;
  notModeled: string | null;
}

export const SCENARIOS: Record<Start, Scenario> = {
  'status-quo': { label: 'Status quo 2026', closures: [], gradeChanges: [], programMoves: [], programMoveCount: 0, notModeled: null },
  'scenario-a': scenario('PPS Scenario A', rightsizing.scenarios.A),
  'scenario-b': scenario('PPS Scenario B', rightsizing.scenarios.B),
};
