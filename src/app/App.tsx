import { useMemo, useReducer, useState } from 'preact/hooks';
import type { Season } from '../sim/types';
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
import { initApp, lastTurn, makeReducer, mapState, type Sim } from './machine';
import { MapSlot, type Overlay, type ZoneLevel } from './MapSlot';

interface AppProps {
  sim: Sim;
  seed: string;
  playbackMs?: number;
}

export function App({ sim, seed, playbackMs }: AppProps) {
  const reduce = useMemo(() => makeReducer(sim), [sim]);
  const [s, dispatch] = useReducer(reduce, undefined, () => initApp(sim, seed));
  const [tool, setTool] = useState<Tool>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const [listed, setListed] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [zoneLevel, setZoneLevel] = useState<ZoneLevel>('elementary');
  const [season, setSeason] = useState<Season>('spring');

  const turn = lastTurn(s);
  const shown = s.phase === 'report' && turn ? turn.end : s.game;
  const plan = useMemo(() => sim.previewBudget(s.game, s.draft), [sim, s.game, s.draft]);
  const map = mapState(s, season);
  const planning = s.phase === 'plan' || s.phase === 'preflight';
  const close = () => setTool('map');
  const when =
    s.phase === 'playing'
      ? `${SEASONS.find((x) => x.id === season)!.month} ${s.game.year}`
      : s.phase === 'report'
        ? `DEC ${s.game.year}`
        : `JAN ${s.game.year}`;

  return (
    <div class="app">
      <TopBar when={when} dials={s.phase === 'report' ? shown.dials : { ...shown.dials, gap: plan.gap }} />
      <main class="stage">
        <MapSlot
          schools={map.schools}
          households={map.households}
          overlay={overlay}
          selected={selected}
          onSelectSchool={setSelected}
          zoneLevel={zoneLevel}
          focus={listed}
        />
        {planning && tool === 'budget' && (
          <BudgetPanel game={s.game} draft={s.draft} plan={plan} onEdit={(policy) => dispatch({ type: 'edit', policy })} onClose={close} />
        )}
        {planning && tool === 'plan' && (
          <PlanPanel
            draft={s.draft}
            base={s.game.policy}
            onSelectSchool={(id) => {
              setSelected(id);
              setListed(id);
              close();
            }}
            onClose={close}
          />
        )}
        {planning && tool === 'layers' && (
          <LayersPanel overlay={overlay} zoneLevel={zoneLevel} onOverlay={setOverlay} onZoneLevel={setZoneLevel} onClose={close} />
        )}
        {planning && tool === 'news' && <NewsPanel reports={s.history.map((t) => t.report)} onClose={close} />}
        {planning && tool === 'map' && selected && (
          <SchoolSheet id={selected} state={shown.schools[selected]} onClose={() => setSelected(null)} />
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
        onEnd={() => dispatch({ type: 'preflight' })}
        disabled={s.phase !== 'plan'}
      />
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
