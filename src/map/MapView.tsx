import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { HIGH_SCHOOLS, SCHOOLS, ZONES, type Point } from '../data';
import { clamp } from '../clamp';
import type { Household, HouseholdStatus, SchoolId, SchoolState } from '../sim/types';
import { NO_DATA_COLOR, SEAT_BANDS, WINDOW_COLORS, WINDOW_LABELS, seatColor, utilization } from './colors';
import { ringsToPath, shortName } from './geometry';
import { Gestures, type Gesture } from './gestures';
import { resolveTap } from './hitTest';
import { drawHouseholds } from './households';
import { boundsOf, centerOn, clampCenter, fitView, panBy, toScreen, toWorld, zoomAt, type View } from './projection';
import { RIVERS } from './rivers';
import { levelFactor, snapLevel, stepLevel, type ZoomLevel } from './zoom';
import './map.css';

export type Overlay = 'none' | 'seats' | 'families';
export type ZoneLevel = 'elementary' | 'middle' | 'high';

export interface MapViewProps {
  schools: Record<SchoolId, SchoolState>;
  households: Household[];
  overlay: Overlay;
  selected: SchoolId | null;
  onSelectSchool: (id: SchoolId) => void;
  zoneLevel: ZoneLevel;
  /** Each new value centers the camera on that school at neighborhood zoom or closer. */
  focus?: SchoolId | null;
}

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

export function badgeSize(enrollment: number): number {
  return Math.round(8 + 8 * Math.sqrt(Math.min(enrollment, 900) / 900));
}

export function MapView(props: MapViewProps) {
  const { schools, households, overlay, selected, onSelectSchool, zoneLevel, focus } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gestures = useRef(new Gestures());
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [view, setView] = useState<View>(() => fitView(MAP_BOUNDS, FALLBACK_SIZE.w, FALLBACK_SIZE.h));
  const [picker, setPicker] = useState<{ at: Point; ids: SchoolId[] } | null>(null);
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
      return centerOn({ ...v, scale }, at, w, h);
    });
  }, [focus]);

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

  const showHouseholds = level === 'street' || overlay === 'families';
  const flickerOn = useRef(true);
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
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
  }, [size]);
  useEffect(() => redraw.current(), [households, view, size, level, overlay]);

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
        gestures.current.down(e.pointerId, local(e));
      }}
      onPointerMove={(e) => apply(gestures.current.move(e.pointerId, local(e)))}
      onPointerUp={(e) => apply(gestures.current.up(e.pointerId, local(e)))}
      onPointerCancel={(e) => gestures.current.cancel(e.pointerId)}
      onWheel={(e) => {
        e.preventDefault();
        zoomTo(stepLevel(level, e.deltaY < 0 ? 1 : -1), local(e));
      }}
    >
      <svg class="pps-map-layer" width={size.w} height={size.h} aria-hidden="true">
        <g transform={`matrix(${view.scale} 0 0 ${view.scale} ${view.tx} ${view.ty})`}>
          <g opacity={overlay === 'families' ? 0.6 : 1}>{zoneLayer}</g>
          {selectedZone && <path class="pps-map-zone-selected" d={ringsToPath(selectedZone.rings)} />}
          {riverLayer}
        </g>
      </svg>
      <canvas ref={canvasRef} class="pps-map-layer pps-map-households" style={{ width: size.w, height: size.h }} />
      <svg class="pps-map-layer" width={size.w} height={size.h} role="img" aria-label="Map of PPS schools">
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
          return (
            <g key={b.id} data-school={b.id} class={`pps-map-badge${open ? '' : ' closed'}`} transform={`translate(${b.x} ${b.y})`}>
              <title>{b.name}</title>
              {b.id === selected && <rect class="pps-map-badge-ring" x={-s / 2 - 3} y={-s / 2 - 3} width={s + 6} height={s + 6} />}
              <rect x={-s / 2} y={-s / 2} width={s} height={s} fill={fill} />
              {overlay === 'none' && open && <rect class="pps-map-roof" x={-s / 2} y={-s / 2} width={s} height={3} />}
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

