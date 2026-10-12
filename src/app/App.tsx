import { useEffect, useMemo, useReducer, useState } from 'preact/hooks';
import { ZONES } from '../data';
import type { Mark } from '../map/MapView';
import type { Start } from '../sim';
import type { BoundaryEdit, Closure, GradeSpanChange, Policy, SchoolId, Season, ZoneLevel } from '../sim/types';
import { NEARBY, startDraft, toggleReceiver, withNames, type CloseDraft } from '../ui/closeSend';
import { CloseSendSheet } from '../ui/CloseSendSheet';
import { SendGradesSheet } from '../ui/SendGradesSheet';
import { StartPicker } from '../ui/StartPicker';
import { BudgetPanel } from '../ui/BudgetPanel';
import { GapBar } from '../ui/GapBar';
import { LayersPanel } from '../ui/LayersPanel';
import { NewsPanel } from '../ui/NewsPanel';
import { PlanPanel } from '../ui/PlanPanel';
import { Playback, SEASONS } from '../ui/Playback';
import { PreflightSheet } from '../ui/PreflightSheet';
import { ReportView } from '../ui/ReportView';
import { SchoolSheet } from '../ui/SchoolSheet';
import { Toolbar, type Tool } from '../ui/Toolbar';
import { TopBar } from '../ui/TopBar';
import { addStroke, sliceSources, startZoneDraft, targets, toEdit, type ZoneDraft } from '../ui/zoneEdit';
import { ZoneSheet } from '../ui/ZoneSheet';
import { calendarItems } from '../ui/calendar';
import { Revealed } from '../ui/Sourced';
import { DECIDED, initApp, lastTurn, makeReducer, mapState, type Sim } from './machine';
import { MapSlot, type MapZoneLevel, type Overlay } from './MapSlot';
import { useMedia } from './useMedia';

interface AppProps {
  sim: Sim;
  seed: string;
  /** Null asks the player to pick one. */
  start?: Start | null;
  onStart?: (start: Start) => void;
  /** Plans already played, to replay on open. */
  saved?: Policy[];
  /** Called with every plan played so far, after each year. */
  onSave?: (played: Policy[]) => void;
  onNewGame?: () => void;
  playbackMs?: number;
}

/** On a phone, sheets cover the lower map, and the zone sheet more of it. Playback and desktop sheets leave the center in view. */
const FOCUS_AT = { sheet: 0.3, zone: 0.18, clear: 0.5 };

/** Matches the stylesheet's desktop layout, where sheets sit beside the map. */
const WIDE = '(min-width: 900px)';

type Sent = { school: SchoolId; receivers: { school: SchoolId }[] };

/** Marks and links for closures in the plan, or the one being drafted. */
function closureMarks(plan: Sent[], draft: CloseDraft | null, candidates: SchoolId[]) {
  const marks: Partial<Record<SchoolId, Mark>> = {};
  const links: [SchoolId, SchoolId][] = [];
  const shown: Sent[] = draft ? [{ school: draft.school, receivers: draft.receivers.map((school) => ({ school })) }] : plan;
  for (const id of candidates) marks[id] = 'candidate';
  for (const c of shown) {
    marks[c.school] = 'closing';
    for (const r of c.receivers) {
      marks[r.school] = 'receiver';
      links.push([c.school, r.school]);
    }
  }
  return { marks, links };
}

/** Marks and links for grade-span changes, or the one being drafted with its nearest candidates. */
function spanMarks(
  marks: Partial<Record<SchoolId, Mark>>,
  links: [SchoolId, SchoolId][],
  spans: { school: SchoolId; to: SchoolId | null }[],
  candidates: SchoolId[],
) {
  for (const id of candidates) marks[id] = 'candidate';
  for (const g of spans) {
    marks[g.school] = 'converting';
    if (!g.to) continue;
    marks[g.to] = 'receiver';
    links.push([g.school, g.to]);
  }
}

/** Marks and links for program moves. A school's closing or converting mark wins. */
function programMarks(marks: Partial<Record<SchoolId, Mark>>, links: Link[], moves: { from: SchoolId[]; to: SchoolId }[]) {
  for (const m of moves) {
    for (const f of m.from) {
      if (marks[f] !== 'closing' && marks[f] !== 'converting') marks[f] = 'program';
      links.push([f, m.to, 'program']);
    }
    marks[m.to] ??= 'receiver';
  }
}

type SpanDraft = { school: SchoolId; to: SchoolId | null };
type Link = [SchoolId, SchoolId, 'program'?];

export function App({ sim, seed, start = 'status-quo', onStart, saved, onSave, onNewGame, playbackMs }: AppProps) {
  const reduce = useMemo(() => makeReducer(sim), [sim]);
  const [s, dispatch] = useReducer(reduce, undefined, () => initApp(sim, seed, start ?? 'status-quo', saved));
  useEffect(() => onSave?.(s.history.map((t) => t.policy)), [s.history]);
  const [picking, setPicking] = useState(start === null);
  const [closeDraft, setCloseDraft] = useState<CloseDraft | null>(null);
  const [spanDraft, setSpanDraft] = useState<SpanDraft | null>(null);
  const [tool, setTool] = useState<Tool>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const [listed, setListed] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [zoneLevel, setZoneLevel] = useState<MapZoneLevel>('elementary');
  const [season, setSeason] = useState<Season>('spring');
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);
  const wide = useMedia(WIDE);

  const turn = lastTurn(s);
  const shown = s.phase === 'report' && turn ? turn.end : s.game;
  const plan = useMemo(() => sim.previewBudget(s.game, s.draft), [sim, s.game, s.draft]);
  const ballot = useMemo(() => sim.ballotPreview(s.game, s.draft), [sim, s.game, s.draft]);
  const levyThrough = sim.levyThrough(s.game);
  const revealed = useMemo(
    () => Object.fromEntries(s.history.flatMap((t) => t.report.reveals.map((r) => [r.sourceKey, r.value]))),
    [s.history],
  );
  const map = mapState(s, season);
  const planning = s.phase === 'plan' || s.phase === 'preflight';
  const close = () => setTool('map');
  const zoning = s.phase === 'plan' && tool === 'map' && zoneDraft ? zoneDraft : null;
  const drafting = s.phase === 'plan' && tool === 'map' && closeDraft && !zoning ? closeDraft : null;
  const sending = s.phase === 'plan' && tool === 'map' && spanDraft && !zoning && !drafting ? spanDraft : null;
  const shut = useMemo(
    () => new Set([...Object.keys(s.game.schools).filter((id) => !s.game.schools[id].open), ...s.draft.closures.map((c) => c.school)]),
    [s.game, s.draft],
  );
  const k5 = useMemo(
    () =>
      new Set([...shut, ...Object.keys(s.game.schools).filter((id) => s.game.schools[id].converted), ...s.draft.gradeChanges.map((g) => g.school)]),
    [shut, s.game, s.draft],
  );
  const middleOf = useMemo(
    () =>
      Object.fromEntries([
        ...Object.values(s.game.schools).flatMap((x) => (x.converted ? [[x.id, sim.middleZoneOf(s.game, x.id)]] : [])),
        ...s.draft.gradeChanges.map((g) => [g.school, g.to]),
      ]),
    [sim, s.game, s.draft],
  );
  const targetsFor = (level: ZoneLevel) => targets(level, level === 'middle' ? k5 : shut);
  const planned = useMemo(() => (zoning ? sim.plannedZones(s.game, s.draft) : null), [sim, s.game, s.draft, !!zoning]);
  const zoneEdit = useMemo(() => {
    if (!zoning || !planned) return null;
    const { slice, level, to } = zoning;
    const shown = slice ? addStroke(zoning, sim.sliceCells({ ...s.game, zones: planned }, level, slice.from, to, slice.percent)) : zoning;
    return toEdit(shown, planned);
  }, [sim, s.game, planned, zoning]);
  const zoneChip = useMemo(
    () => (zoneEdit?.cells.length ? sim.boundaryChip(s.game, zoneEdit, s.draft) : null),
    [sim, s.game, s.draft, zoneEdit],
  );
  const hasZone = (id: SchoolId) => (['elementary', 'middle'] as const).some((l) => targetsFor(l).some((t) => t.id === id));
  const editBoundary = (id: SchoolId | null) => {
    const level: ZoneLevel = id && !ZONES.elementary.some((z) => z.school === id) ? 'middle' : 'elementary';
    const to = id && hasZone(id) ? id : targetsFor(level)[0].id;
    setSelected(null);
    setCloseDraft(null);
    setSpanDraft(null);
    setZoneDraft(startZoneDraft(level, to));
    setTool('map');
  };
  const commitBoundary = (edit: BoundaryEdit) => {
    dispatch({ type: 'edit', policy: { boundaryEdits: [...s.draft.boundaryEdits, edit] } });
    setZoneDraft(null);
  };
  const candidates = drafting
    ? withNames(sim.receiverCandidates(
        s.game.schools,
        drafting.school,
        s.draft.closures.filter((c) => c.school !== drafting.school),
        s.draft.gradeChanges,
      ),
    )
    : [];
  const spanCandidates = sending ? withNames(sim.middleSchoolCandidates(s.game.schools, sending.school, s.draft.closures)) : [];
  const played = s.phase === 'playing' || s.phase === 'report' ? (turn?.report.closures ?? []) : [];
  const playedSpans = s.phase === 'playing' || s.phase === 'report' ? (turn?.report.conversions ?? []) : [];
  const playedPrograms = s.phase === 'playing' || s.phase === 'report' ? (turn?.report.programMoves ?? []) : [];
  const { marks, links } = closureMarks(
    sending ? [] : planning ? s.draft.closures : played,
    drafting,
    drafting?.step === 1 ? candidates.slice(0, NEARBY).map((c) => c.id) : [],
  );
  spanMarks(
    marks,
    links,
    drafting ? [] : sending ? [sending] : planning ? s.draft.gradeChanges : playedSpans,
    spanCandidates.slice(0, NEARBY).map((c) => c.id),
  );
  programMarks(marks, links, drafting || sending ? [] : planning ? s.draft.programMoves : playedPrograms);
  if (zoning) marks[zoning.to] = 'receiver';
  const firstPlayed = played[0]?.school ?? playedSpans[0]?.school ?? playedPrograms[0]?.from[0];
  const flows = s.phase === 'playing' && !!firstPlayed && DECIDED.includes(season);
  const focus =
    s.phase === 'playing' && firstPlayed && season !== 'spring' ? firstPlayed : (zoning?.to ?? drafting?.school ?? sending?.school ?? listed);
  const onMapTap = (id: SchoolId) => {
    if (drafting?.step === 1 && candidates.some((c) => c.id === id)) setCloseDraft(toggleReceiver(drafting, id));
    else if (sending && spanCandidates.some((c) => c.id === id)) setSpanDraft({ ...sending, to: id });
    else if (!drafting && !sending) {
      setSelected(id);
      setTool('map');
    }
  };
  const closing = s.draft.closures.find((c) => c.school === selected);
  const converting = s.draft.gradeChanges.find((g) => g.school === selected);
  const gradesFrom = s.draft.gradeChanges.filter((g) => g.to === selected).map((g) => g.school);
  const commitSpan = (g: GradeSpanChange) => {
    dispatch({ type: 'edit', policy: { gradeChanges: [...s.draft.gradeChanges.filter((x) => x.school !== g.school), g] } });
    setSpanDraft(null);
  };
  /** Closing a receiver or a boundary edit's target would silently drop those edits, so it can't close. */
  const receivesFrom = s.draft.closures.filter((c) => c.receivers.some((r) => r.school === selected)).map((c) => c.school);
  const rezonedInto = s.draft.boundaryEdits.some((e) => e.to === selected);
  const programMoves = s.draft.programMoves.filter((m) => m.to === selected || m.from.includes(selected!));
  /** Closing a program's new school would silently drop the move. */
  const programInto = programMoves.some((m) => m.to === selected);
  /** A K-5 school takes no 6-8 blocks, so those edits block Send 6–8. */
  const middleInto = s.draft.boundaryEdits.some((e) => e.level === 'middle' && e.to === selected);
  const commit = (c: Closure) =>
    dispatch({ type: 'edit', policy: { closures: [...s.draft.closures.filter((x) => x.school !== c.school), c] } });
  const when =
    s.phase === 'playing'
      ? `${SEASONS.find((x) => x.id === season)!.month} ${s.game.year}`
      : s.phase === 'report'
        ? `DEC ${s.game.year}`
        : `JAN ${s.game.year}`;

  return (
    <Revealed.Provider value={revealed}>
      <div class="app">
        {s.phase === 'report' ? (
          <TopBar when={when} wide={wide} dials={shown.dials} gapLabel={`${shown.year}-${String(shown.year + 1).slice(2)} gap`} />
        ) : (
          <TopBar when={when} wide={wide} dials={{ ...shown.dials, gap: s.phase === 'playing' && turn ? turn.report.budget.gap : plan.gap }} />
        )}
        <main class="stage">
          <MapSlot
            schools={map.schools}
            households={map.households}
            overlay={overlay}
            selected={selected}
            onSelectSchool={onMapTap}
            zoneLevel={zoning?.level ?? zoneLevel}
            zoneEdit={
              zoning && planned && zoneEdit
                ? {
                    level: zoning.level,
                    zones: planned[zoning.level],
                    target: zoning.to,
                    painted: zoneEdit.cells,
                    onStroke: (cells) => setZoneDraft(addStroke(zoning, cells)),
                  }
                : undefined
            }
            focus={focus}
            focusAt={wide || s.phase === 'playing' ? FOCUS_AT.clear : zoning ? FOCUS_AT.zone : FOCUS_AT.sheet}
            marks={marks}
            links={links}
            flows={flows}
          />
          <p class="side-hint">To plan, pick a school or the $ button. To play the year, press ▶.</p>
          {planning && tool === 'budget' && (
            <BudgetPanel
              game={s.game}
              draft={s.draft}
              plan={plan}
              ballot={ballot}
              levyThrough={levyThrough}
              onEdit={(policy) => dispatch({ type: 'edit', policy })} onClose={close} />
          )}
          {planning && tool === 'plan' && (
            <PlanPanel
              draft={s.draft}
              base={s.game.policy}
              start={s.start}
              onEdit={(policy) => dispatch({ type: 'edit', policy })}
              onSelectSchool={(id) => {
                setSelected(id);
                setListed(id);
                setZoneDraft(null);
                close();
              }}
              onEditBoundary={s.phase === 'plan' ? () => editBoundary(selected) : undefined}
              calendar={calendarItems(s.game.year, levyThrough)}
              ballot={ballot}
              year={s.game.year}
              onNewGame={onNewGame}
              onClose={close}
            />
          )}
          {planning && tool === 'layers' && (
            <LayersPanel overlay={overlay} zoneLevel={zoneLevel} onOverlay={setOverlay} onZoneLevel={setZoneLevel} onClose={close} />
          )}
          {planning && tool === 'news' && <NewsPanel reports={s.history.map((t) => t.report)} onClose={close} />}
          {drafting && (
            <CloseSendSheet
              draft={drafting}
              candidates={candidates}
              chipFor={(c) => sim.closureChip(s.game, c, s.draft.closures, s.draft.k5ClassSize, s.draft.gradeChanges, s.draft.programMoves)}
              onChange={setCloseDraft}
              onCommit={commit}
              onClose={() => setCloseDraft(null)}
            />
          )}
          {sending && (
            <SendGradesSheet
              school={sending.school}
              candidates={spanCandidates}
              to={sending.to}
              chip={sending.to ? sim.conversionChip(s.game, { school: sending.school, to: sending.to }, s.draft) : null}
              onPick={(to) => setSpanDraft({ ...sending, to })}
              onCommit={commitSpan}
              onClose={() => setSpanDraft(null)}
            />
          )}
          {zoning && zoneEdit && (
            <ZoneSheet
              draft={zoning}
              edit={zoneEdit}
              chip={zoneChip}
              targetsFor={targetsFor}
              middleOf={middleOf}
              sources={planned ? sliceSources(zoning.level, planned, zoning.to) : []}
              onChange={setZoneDraft}
              onCommit={commitBoundary}
              onClose={() => setZoneDraft(null)}
            />
          )}
          {planning && tool === 'map' && selected && !drafting && !zoning && !sending && (
            <SchoolSheet
              id={selected}
              state={shown.schools[selected]}
              onClose={() => setSelected(null)}
              closing={closing}
              receivesFrom={receivesFrom}
              rezonedInto={rezonedInto}
              converting={converting}
              gradesFrom={gradesFrom}
              middleSchool={shown.schools[selected]?.converted ? sim.middleZoneOf(shown, selected) : undefined}
              programMoves={programMoves}
              onCloseSend={
                s.phase === 'plan' &&
                receivesFrom.length === 0 &&
                !rezonedInto &&
                !programInto &&
                !converting &&
                gradesFrom.length === 0 &&
                sim.canClose(s.game.schools, selected)
                  ? () => setCloseDraft(startDraft(selected, closing))
                  : undefined
              }
              onSendGrades={
                s.phase === 'plan' && !closing && !middleInto && sim.canConvert(s.game.schools, selected, s.draft.closures)
                  ? () => setSpanDraft({ school: selected, to: converting?.to ?? null })
                  : undefined
              }
              onEditBoundary={s.phase === 'plan' && hasZone(selected) ? () => editBoundary(selected) : undefined}
            />
          )}
          {s.phase === 'playing' && turn && (
            <Playback
              report={turn.report}
              onSeason={setSeason}
              onDone={() => dispatch({ type: 'playbackDone' })}
              durationMs={playbackMs}
            />
          )}
          {s.phase === 'report' && turn && (
            <ReportView
              report={turn.report}
              turn={s.history.length}
              walk={
                turn.policy.boundaryEdits.length || turn.report.rezoned
                  ? { before: turn.start.dials.walkK5, after: turn.end.dials.walkK5 }
                  : undefined
              }
              onNext={() => {
                setTool('map');
                dispatch({ type: 'nextYear' });
              }}
            />
          )}
        </main>
        {planning && <GapBar budget={plan} />}
        <Toolbar
          active={tool}
          onPick={setTool}
          onPlay={() => {
            setCloseDraft(null);
            setSpanDraft(null);
            setZoneDraft(null);
            dispatch({ type: 'preflight' });
          }}
          disabled={s.phase !== 'plan'}
        />
        {picking && (
          <StartPicker
            onPick={(start) => {
              dispatch({ type: 'restart', start });
              onStart?.(start);
              setPicking(false);
            }}
          />
        )}
        {s.phase === 'preflight' && (
          <PreflightSheet
            year={s.game.year}
            draft={s.draft}
            base={s.game.policy}
            budget={plan}
            ballot={ballot}
            closurePrograms={sim.closureProgramMoves(s.game, s.draft)}
            onBack={() => dispatch({ type: 'back' })}
            onConfirm={() => dispatch({ type: 'confirm' })}
          />
        )}
      </div>
    </Revealed.Provider>
  );
}
