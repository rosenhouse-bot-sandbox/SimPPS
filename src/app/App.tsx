import { useMemo, useReducer, useState } from 'preact/hooks';
import { ZONES } from '../data';
import type { Mark } from '../map/MapView';
import type { Start } from '../sim';
import type { BoundaryEdit, Closure, SchoolId, Season, ZoneLevel as EditLevel } from '../sim/types';
import { NEARBY, startDraft, toggleReceiver, withNames, type CloseDraft } from '../ui/closeSend';
import { CloseSendSheet } from '../ui/CloseSendSheet';
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
import { DECIDED, initApp, lastTurn, makeReducer, mapState, type Sim } from './machine';
import { MapSlot, type Overlay, type ZoneLevel } from './MapSlot';

interface AppProps {
  sim: Sim;
  seed: string;
  /** Null asks the player to pick one. */
  start?: Start | null;
  onStart?: (start: Start) => void;
  playbackMs?: number;
}

/** Sheets cover the lower map, and the zone sheet more of it. In playback the season sits above center and the ticker below. */
const FOCUS_AT = { sheet: 0.3, zone: 0.18, playback: 0.5 };

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

export function App({ sim, seed, start = 'status-quo', onStart, playbackMs }: AppProps) {
  const reduce = useMemo(() => makeReducer(sim), [sim]);
  const [s, dispatch] = useReducer(reduce, undefined, () => initApp(sim, seed, start ?? 'status-quo'));
  const [picking, setPicking] = useState(start === null);
  const [closeDraft, setCloseDraft] = useState<CloseDraft | null>(null);
  const [tool, setTool] = useState<Tool>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const [listed, setListed] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [zoneLevel, setZoneLevel] = useState<ZoneLevel>('elementary');
  const [season, setSeason] = useState<Season>('spring');
  const [zoneDraft, setZoneDraft] = useState<ZoneDraft | null>(null);

  const turn = lastTurn(s);
  const shown = s.phase === 'report' && turn ? turn.end : s.game;
  const plan = useMemo(() => sim.previewBudget(s.game, s.draft), [sim, s.game, s.draft]);
  const map = mapState(s, season);
  const planning = s.phase === 'plan' || s.phase === 'preflight';
  const close = () => setTool('map');
  const zoning = s.phase === 'plan' && tool === 'map' && zoneDraft ? zoneDraft : null;
  const drafting = s.phase === 'plan' && tool === 'map' && closeDraft && !zoning ? closeDraft : null;
  const shut = useMemo(
    () => new Set([...Object.keys(s.game.schools).filter((id) => !s.game.schools[id].open), ...s.draft.closures.map((c) => c.school)]),
    [s.game, s.draft],
  );
  const targetsFor = (level: EditLevel) => targets(level, shut);
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
  const hasZone = (id: SchoolId) => !shut.has(id) && (['elementary', 'middle'] as const).some((l) => ZONES[l].some((z) => z.school === id));
  const editBoundary = (id: SchoolId | null) => {
    const level: EditLevel = id && !ZONES.elementary.some((z) => z.school === id) ? 'middle' : 'elementary';
    const to = id && hasZone(id) ? id : targetsFor(level)[0].id;
    setSelected(null);
    setCloseDraft(null);
    setZoneDraft(startZoneDraft(level, to));
    setTool('map');
  };
  const commitBoundary = (edit: BoundaryEdit) => {
    dispatch({ type: 'edit', policy: { boundaryEdits: [...s.draft.boundaryEdits, edit] } });
    setZoneDraft(null);
  };
  const candidates = drafting
    ? withNames(sim.receiverCandidates(s.game.schools, drafting.school, s.draft.closures.filter((c) => c.school !== drafting.school)))
    : [];
  const played = s.phase === 'playing' || s.phase === 'report' ? (turn?.report.closures ?? []) : [];
  const { marks, links } = closureMarks(
    planning ? s.draft.closures : played,
    drafting,
    drafting?.step === 1 ? candidates.slice(0, NEARBY).map((c) => c.id) : [],
  );
  if (zoning) marks[zoning.to] = 'receiver';
  const flows = s.phase === 'playing' && played.length > 0 && DECIDED.includes(season);
  const focus =
    s.phase === 'playing' && played.length > 0 && season !== 'spring' ? played[0].school : (zoning?.to ?? drafting?.school ?? listed);
  const onMapTap = (id: SchoolId) => {
    if (drafting?.step === 1 && candidates.some((c) => c.id === id)) setCloseDraft(toggleReceiver(drafting, id));
    else if (!drafting) setSelected(id);
  };
  const closing = s.draft.closures.find((c) => c.school === selected);
  /** Closing a receiver or a boundary edit's target would silently drop those edits, so it can't close. */
  const receivesFrom = s.draft.closures.filter((c) => c.receivers.some((r) => r.school === selected)).map((c) => c.school);
  const rezonedInto = s.draft.boundaryEdits.some((e) => e.to === selected);
  const commit = (c: Closure) =>
    dispatch({ type: 'edit', policy: { closures: [...s.draft.closures.filter((x) => x.school !== c.school), c] } });
  const when =
    s.phase === 'playing'
      ? `${SEASONS.find((x) => x.id === season)!.month} ${s.game.year}`
      : s.phase === 'report'
        ? `DEC ${s.game.year}`
        : `JAN ${s.game.year}`;

  return (
    <div class="app">
      {s.phase === 'report' ? (
        <TopBar when={when} dials={shown.dials} gapLabel={`${shown.year}-${String(shown.year + 1).slice(2)} gap`} />
      ) : (
        <TopBar when={when} dials={{ ...shown.dials, gap: s.phase === 'playing' && turn ? turn.report.budget.gap : plan.gap }} />
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
          focusAt={s.phase === 'playing' ? FOCUS_AT.playback : zoning ? FOCUS_AT.zone : FOCUS_AT.sheet}
          marks={marks}
          links={links}
          flows={flows}
        />
        {planning && tool === 'budget' && (
          <BudgetPanel game={s.game} draft={s.draft} plan={plan} onEdit={(policy) => dispatch({ type: 'edit', policy })} onClose={close} />
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
            chipFor={(c) => sim.closureChip(s.game, c, s.draft.closures, s.draft.k5ClassSize)}
            onChange={setCloseDraft}
            onCommit={commit}
            onClose={() => setCloseDraft(null)}
          />
        )}
        {zoning && zoneEdit && (
          <ZoneSheet
            draft={zoning}
            edit={zoneEdit}
            chip={zoneChip}
            targetsFor={targetsFor}
            sources={planned ? sliceSources(zoning.level, planned, zoning.to) : []}
            onChange={setZoneDraft}
            onCommit={commitBoundary}
            onClose={() => setZoneDraft(null)}
          />
        )}
        {planning && tool === 'map' && selected && !drafting && !zoning && (
          <SchoolSheet
            id={selected}
            state={shown.schools[selected]}
            onClose={() => setSelected(null)}
            closing={closing}
            receivesFrom={receivesFrom}
            rezonedInto={rezonedInto}
            onCloseSend={
              s.phase === 'plan' && receivesFrom.length === 0 && !rezonedInto && sim.canClose(s.game.schools, selected)
                ? () => setCloseDraft(startDraft(selected, closing))
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
        onEnd={() => {
          setCloseDraft(null);
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
          onBack={() => dispatch({ type: 'back' })}
          onConfirm={() => dispatch({ type: 'confirm' })}
        />
      )}
    </div>
  );
}
