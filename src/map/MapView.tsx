import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { HIGH_SCHOOLS, SCHOOLS, ZONES, type Point } from '../data';
import { clamp } from '../clamp';
import { zoneGrid } from '../sim';
import type { Household, HouseholdStatus, SchoolId, SchoolState } from '../sim/types';
import { zoneBorders } from './borders';
import { NO_DATA_COLOR, SEAT_BANDS, WINDOW_COLORS, WINDOW_LABELS, seatColor, utilization } from './colors';
import { ringsToPath, shortName } from './geometry';
import { Gestures, type Gesture } from './gestures';
import { resolveTap } from './hitTest';
import { strokeCells } from './paint';
import { drawHouseholds } from './households';
import { boundsOf, centerOn, clampCenter, fitView, panBy, toScreen, toWorld, zoomAt, type View } from './projection';
import { RIVERS } from './rivers';
import { levelFactor, snapLevel, stepLevel, type ZoomLevel } from './zoom';
import './map.css';

export type Overlay = 'none' | 'seats' | 'families';
/** Close & send highlights: the school closing, its receivers and schools that could receive. */
export type Mark = 'closing' | 'receiver' | 'candidate';
export type ZoneLevel = 'elementary' | 'middle' | 'high';

/** Zone mode: the block grid, where one finger paints and two pan. */
export interface ZoneEditProps {
  level: 'elementary' | 'middle';
  /** Each cell's zone school before this edit. */
  zones: readonly SchoolId[];
  target: SchoolId;
  painted: readonly number[];
  /** A finished stroke's cells, in paint order. */
  onStroke: (cells: number[]) => void;
}

export interface MapViewProps {
  schools: Record<SchoolId, SchoolState>;
  households: Household[];
  overlay: Overlay;
  selected: SchoolId | null;
  onSelectSchool: (id: SchoolId) => void;
  zoneLevel: ZoneLevel;
  /** Each new value centers the camera on that school at neighborhood zoom or closer. */
  focus?: SchoolId | null;
  /** Where the focus lands, as a share of the map's height from the top. */
  focusAt?: number;
  marks?: Partial<Record<SchoolId, Mark>>;
  /** Closed or closing school to receiver. */
  links?: [SchoolId, SchoolId][];
  /** Draws closure movers' trails, growing in over FLOW_MS. */
  flows?: boolean;
  zoneEdit?: ZoneEditProps;
}

export const FLOW_MS = 1500;

/** Used until the container reports a size, and in jsdom. */
export const FALLBACK_SIZE = { w: 360, h: 640 };

const MAP_PAD_M = 1500;
const ALL_SCHOOLS = [...SCHOOLS, ...HIGH_SCHOOLS];
const SCHOOL_BOUNDS = boundsOf(ALL_SCHOOLS.map((s) => [s.x, s.y] as Point));
export const MAP_BOUNDS = {
  minX: SCHOOL_BOUNDS.minX - MAP_PAD_M,
  minY: SCHOOL_BOUNDS.minY - MAP_PAD_M,
  maxX: SCHOOL_BOUNDS.maxX + MAP_PAD_M,
  maxY: SCHOOL_BOUNDS.maxY + MAP_PAD_M,
};
const SCHOOL_POS = new Map<SchoolId, Point>(ALL_SCHOOLS.map((s) => [s.id, [s.x, s.y]]));
const schoolPos = (id: SchoolId) => SCHOOL_POS.get(id);

const LAND = ['#27331f', '#2b3722', '#232e1c'];
const BADGE_FILL = '#e9dcb0';
const MIN_FACTOR = 0.7;
const MAX_FACTOR = 9;

const zonePaths = new Map<ZoneLevel, string[]>();
function pathsFor(level: ZoneLevel): string[] {
  if (!zonePaths.has(level)) zonePaths.set(level, ZONES[level].map((z) => ringsToPath(z.rings)));
  return zonePaths.get(level)!;
}

const ZONE_TONES = ['#2f3d25', '#3a3a24', '#26392f', '#3b3229', '#2c3436', '#35402a'];
const TARGET_FILL = '#55703f';

let cellPaths: string[] | undefined;
const cellPath = (id: number) => (cellPaths ??= zoneGrid().cells.map((c) => ringsToPath(c.rings)))[id];

/** One fill path per zone school. */
function fillPaths(zones: readonly SchoolId[]): Map<SchoolId, string> {
  const out = new Map<SchoolId, string>();
  zones.forEach((s, id) => out.set(s, (out.get(s) ?? '') + cellPath(id)));
  return out;
}

function ZoneGrid({ edit, stroke }: { edit: ZoneEditProps; stroke: readonly number[] }) {
  const { level, zones, target, painted } = edit;
  const fills = useMemo(() => fillPaths(zones), [zones]);
  const order = useMemo(() => new Map(ZONES[level].map((z, i) => [z.school, i])), [level]);
  const changed = useMemo(
    () => [...new Set([...painted, ...stroke])].filter((c) => zones[c] !== target),
    [zones, target, painted, stroke],
  );
  const after = useMemo(() => {
    const out = [...zones];
    for (const c of changed) out[c] = target;
    return out;
  }, [zones, target, changed]);
  const grid = useMemo(() => zoneGrid().cells.map((c) => cellPath(c.id)).join(''), []);
  return (
    <g data-testid="zone-grid">
      {[...fills].map(([school, d]) => (
        <path
          key={school}
          data-zone-fill={school}
          d={d}
          fill={school === target ? TARGET_FILL : ZONE_TONES[(order.get(school) ?? 0) % ZONE_TONES.length]}
        />
      ))}
      <path class="pps-map-gridlines" d={grid} />
      <path class="pps-map-painted" data-painted d={changed.map(cellPath).join('')} />
      <path class="pps-map-borders" d={useMemo(() => zoneBorders(after), [after])} />
      <path class="pps-map-outline" data-outline={target} d={useMemo(() => zoneBorders(after, (s) => s === target), [after, target])} />
    </g>
  );
}

export function badgeSize(enrollment: number): number {
  return Math.round(8 + 8 * Math.sqrt(Math.min(enrollment, 900) / 900));
}

export function MapView(props: MapViewProps) {
  const { schools, households, overlay, selected, onSelectSchool, zoneLevel, focus, focusAt = 0.5, marks = {}, links = [], flows = false, zoneEdit } =
    props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestures = useRef(new Gestures());
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [view, setView] = useState<View>(() => fitView(MAP_BOUNDS, FALLBACK_SIZE.w, FALLBACK_SIZE.h));
  const [picker, setPicker] = useState<{ at: Point; ids: SchoolId[] } | null>(null);
  const [stroke, setStroke] = useState<number[]>([]);
  const strokeRef = useRef<number[]>([]);
  gestures.current.paint = !!zoneEdit;
  const fit = useMemo(() => fitView(MAP_BOUNDS, size.w, size.h), [size]);
  const level = snapLevel(view.scale / fit.scale);

  /** At district zoom the whole district stays in view. */
  const settle = (v: View) => (v.scale <= fit.scale * 1.001 ? fit : clampCenter(v, MAP_BOUNDS, size.w, size.h));
  const zoomTo = (target: ZoomLevel, anchor: Point = [size.w / 2, size.h / 2]) =>
    setView((v) => settle(zoomAt(v, fit.scale * levelFactor(target), anchor)));

  const sizeRef = useRef(FALLBACK_SIZE);
  useEffect(() => {
    const el = containerRef.current!;
    let measured = false;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const old = sizeRef.current;
      if (!w || !h || (old.w === w && old.h === h)) return;
      const keep = measured;
      const zoomedIn = (v: View) => v.scale > fitView(MAP_BOUNDS, old.w, old.h).scale * 1.001;
      setView((v) =>
        keep && zoomedIn(v) ? centerOn(v, toWorld(v, [old.w / 2, old.h / 2]), w, h) : fitView(MAP_BOUNDS, w, h),
      );
      measured = true;
      sizeRef.current = { w, h };
      setSize(sizeRef.current);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const at = focus ? schoolPos(focus) : undefined;
    if (!at) return;
    setView((v) => {
      const { w, h } = sizeRef.current;
      const scale = Math.max(v.scale, fitView(MAP_BOUNDS, w, h).scale * levelFactor('neighborhood'));
      return centerOn({ ...v, scale }, at, w, h * 2 * focusAt);
    });
  }, [focus, focusAt]);

  const badges = useMemo(
    () =>
      SCHOOLS.map((s) => {
        const state = schools[s.id];
        const [x, y] = toScreen(view, [s.x, s.y]);
        return { id: s.id, name: s.name, x, y, state, enrollment: state?.enrollment ?? s.enrollment ?? 0 };
      }),
    [schools, view],
  );
  const onScreen = (x: number, y: number) => x > -60 && y > -30 && x < size.w + 60 && y < size.h + 30;

  const showHouseholds = level === 'street' || overlay === 'families' || flows;
  const flickerOn = useRef(true);
  const flowShare = useRef(0);
  const redraw = useRef(() => {});
  redraw.current = () => {
    const canvas = canvasRef.current;
    const ctx = canvas && getContext(canvas);
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    if (!showHouseholds) return;
    drawHouseholds(ctx, households, view, {
      width: size.w,
      height: size.h,
      level,
      emphasize: overlay === 'families',
      flickerOn: flickerOn.current,
      schoolPos,
      flows: flows ? flowShare.current : undefined,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
  }, [size]);
  useEffect(() => redraw.current(), [households, view, size, level, overlay]);

  useEffect(() => {
    flowShare.current = 0;
    if (!flows) return;
    if (prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      flowShare.current = 1;
      redraw.current();
      return;
    }
    let start: number | null = null;
    let id = 0;
    const tick = (t: number) => {
      start ??= t;
      flowShare.current = Math.min(1, (t - start) / FLOW_MS);
      redraw.current();
      if (flowShare.current < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [flows, households]);

  const anyReturned = useMemo(() => households.some((h) => h.status === 'returned'), [households]);
  useEffect(() => {
    if (!showHouseholds || !anyReturned || prefersReducedMotion()) return;
    const id = setInterval(() => {
      flickerOn.current = !flickerOn.current;
      redraw.current();
    }, 450);
    return () => {
      clearInterval(id);
      flickerOn.current = true;
    };
  }, [showHouseholds, anyReturned]);

  const local = (e: PointerEvent | WheelEvent): Point => {
    const r = containerRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const apply = (g: Gesture | null) => {
    if (!g) return;
    if (g.kind === 'pan') setView((v) => settle(panBy(v, g.dx, g.dy)));
    if (g.kind === 'pinch') {
      setView((v) => {
        const scale = clamp(v.scale * g.factor, fit.scale * MIN_FACTOR, fit.scale * MAX_FACTOR);
        return settle(zoomAt(panBy(v, g.dx, g.dy), scale, g.center));
      });
    }
    if (g.kind === 'pinchEnd') setView((v) => settle(zoomAt(v, fit.scale * levelFactor(snapLevel(v.scale / fit.scale)), g.center)));
    if (g.kind === 'stroke') {
      const add = strokeCells(toWorld(view, g.from), toWorld(view, g.to)).filter((c) => !strokeRef.current.includes(c));
      if (add.length) setStroke((strokeRef.current = [...strokeRef.current, ...add]));
    }
    if (g.kind === 'strokeEnd' || g.kind === 'strokeCancel') {
      const cells = strokeRef.current;
      setStroke((strokeRef.current = []));
      if (g.kind === 'strokeEnd' && cells.length) zoneEdit?.onStroke(cells);
    }
    if (g.kind === 'tap') {
      const tap = resolveTap(badges, g.at);
      if (tap.kind === 'select') onSelectSchool(tap.id);
      setPicker(tap.kind === 'pick' ? { at: g.at, ids: tap.ids } : null);
    }
  };

  const zoneLayer = useMemo(
    () => (
      <g>
        {pathsFor(zoneLevel).map((d, i) => (
          <path key={i} data-zone={ZONES[zoneLevel][i].school} d={d} fill={LAND[i % LAND.length]} class="pps-map-zone" />
        ))}
      </g>
    ),
    [zoneLevel],
  );
  const riverLayer = useMemo(
    () => (
      <g class="pps-map-rivers">
        {RIVERS.map((r) => (
          <polyline key={r.name} points={r.points.join(' ')} stroke-width={r.width} />
        ))}
      </g>
    ),
    [],
  );
  const selectedZone = selected ? ZONES[zoneLevel].find((z) => z.school === selected) : undefined;
  const nameOf = (id: SchoolId) => SCHOOLS.find((s) => s.id === id)?.name ?? id;

  return (
    <div
      ref={containerRef}
      class={`pps-map pps-map-${level} pps-map-overlay-${overlay}`}
      onPointerDown={(e) => {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        apply(gestures.current.down(e.pointerId, local(e)));
      }}
      onPointerMove={(e) => apply(gestures.current.move(e.pointerId, local(e)))}
      onPointerUp={(e) => apply(gestures.current.up(e.pointerId, local(e)))}
      onPointerCancel={(e) => {
        gestures.current.cancel(e.pointerId);
        setStroke((strokeRef.current = []));
      }}
      onWheel={(e) => {
        e.preventDefault();
        zoomTo(stepLevel(level, e.deltaY < 0 ? 1 : -1), local(e));
      }}
    >
      <svg class="pps-map-layer" width={size.w} height={size.h} aria-hidden="true">
        <g transform={`matrix(${view.scale} 0 0 ${view.scale} ${view.tx} ${view.ty})`}>
          {zoneEdit ? (
            <ZoneGrid edit={zoneEdit} stroke={stroke} />
          ) : (
            <g opacity={overlay === 'families' ? 0.6 : 1}>{zoneLayer}</g>
          )}
          {selectedZone && !zoneEdit && <path class="pps-map-zone-selected" d={ringsToPath(selectedZone.rings)} />}
          {riverLayer}
        </g>
      </svg>
      <canvas ref={canvasRef} class="pps-map-layer pps-map-households" style={{ width: size.w, height: size.h }} />
      <svg class="pps-map-layer" width={size.w} height={size.h} role="img" aria-label="Map of PPS schools">
        {links.map(([from, to]) => {
          const a = schoolPos(from);
          const b = schoolPos(to);
          if (!a || !b) return null;
          const [x1, y1] = toScreen(view, a);
          const [x2, y2] = toScreen(view, b);
          return <line key={`${from}>${to}`} data-link={`${from}>${to}`} class="pps-map-link" x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
        {HIGH_SCHOOLS.map((h) => {
          const [x, y] = toScreen(view, [h.x, h.y]);
          if (!onScreen(x, y)) return null;
          return (
            <g key={h.id} data-hs={h.id} class="pps-map-hs" transform={`translate(${x} ${y})`}>
              <title>{`${h.name} (fixed)`}</title>
              <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" />
              {level !== 'district' && <text y={18}>{shortName(h.name)}</text>}
            </g>
          );
        })}
        {badges.map((b) => {
          if (!onScreen(b.x, b.y)) return null;
          const s = badgeSize(b.enrollment);
          const open = b.state?.open ?? true;
          const fill = !open ? '#2a2a2a' : overlay === 'seats' ? seatColor(b.state ? utilization(b.state) : null) : BADGE_FILL;
          const mark = marks[b.id];
          const h = s / 2;
          return (
            <g
              key={b.id}
              data-school={b.id}
              data-mark={mark}
              class={`pps-map-badge${open ? '' : ' closed'}`}
              transform={`translate(${b.x} ${b.y})`}
            >
              <title>{open ? b.name : `${b.name} (closed)`}</title>
              {mark && <rect class={`pps-map-mark pps-map-mark-${mark}`} x={-h - 5} y={-h - 5} width={s + 10} height={s + 10} />}
              {b.id === selected && <rect class="pps-map-badge-ring" x={-h - 3} y={-h - 3} width={s + 6} height={s + 6} />}
              <rect x={-h} y={-h} width={s} height={s} fill={fill} />
              {overlay === 'none' && open && <rect class="pps-map-roof" x={-h} y={-h} width={s} height={3} />}
              {!open && <path class="pps-map-boards" d={`M${-h} ${-h / 2}L${h} ${h / 2}M${-h} ${h / 2}L${h} ${-h / 2}`} />}
              {level !== 'district' && <text y={s / 2 + 11}>{shortName(b.name)}</text>}
            </g>
          );
        })}
      </svg>
      <Legend overlay={overlay} />
      <div class="pps-map-zoom" onPointerDown={stop}>
        <button type="button" aria-label="Zoom in" disabled={level === 'street'} onClick={() => zoomTo(stepLevel(level, 1))}>
          +
        </button>
        <button type="button" aria-label="Zoom out" disabled={level === 'district'} onClick={() => zoomTo(stepLevel(level, -1))}>
          −
        </button>
      </div>
      {picker && (
        <div
          class="pps-map-picker"
          role="dialog"
          aria-label="Choose a school"
          onPointerDown={stop}
          style={{ left: clamp(picker.at[0] - 90, 8, size.w - 188), top: clamp(picker.at[1] + 16, 8, size.h - 200) }}
        >
          {picker.ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSelectSchool(id);
                setPicker(null);
              }}
            >
              {shortName(nameOf(id))}
            </button>
          ))}
          <button type="button" class="pps-map-picker-close" onClick={() => setPicker(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function Legend({ overlay }: { overlay: Overlay }) {
  if (overlay === 'seats') {
    const rows = [...SEAT_BANDS.map((b) => [b.color, b.label]), [NO_DATA_COLOR, 'No capacity data']];
    return (
      <div class="pps-map-legend" onPointerDown={stop}>
        <strong>Seats used</strong>
        {rows.map(([color, label]) => (
          <div key={label}>
            <i style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>
    );
  }
  if (overlay === 'families') {
    return (
      <div class="pps-map-legend" onPointerDown={stop}>
        <strong>Families</strong>
        {(Object.keys(WINDOW_LABELS) as HouseholdStatus[]).map((s) => (
          <div key={s}>
            <i style={{ background: WINDOW_COLORS[s] }} />
            {WINDOW_LABELS[s]}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function stop(e: Event) {
  e.stopPropagation();
}

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

