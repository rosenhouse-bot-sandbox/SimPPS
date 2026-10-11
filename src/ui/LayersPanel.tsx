import type { Overlay, ZoneLevel } from '../app/MapSlot';
import { Window } from './Window';

const OVERLAYS: { id: Overlay; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'seats', label: 'Seats' },
  { id: 'families', label: 'Families' },
];

const LEVELS: { id: ZoneLevel; label: string }[] = [
  { id: 'elementary', label: 'Elementary' },
  { id: 'middle', label: 'Middle' },
  { id: 'high', label: 'High' },
];

function Choice<T extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend>{name}</legend>
      {options.map((o) => (
        <label key={o.id} class="row choice">
          <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

interface LayersProps {
  overlay: Overlay;
  zoneLevel: ZoneLevel;
  onOverlay: (o: Overlay) => void;
  onZoneLevel: (z: ZoneLevel) => void;
  onClose: () => void;
}

export function LayersPanel({ overlay, zoneLevel, onOverlay, onZoneLevel, onClose }: LayersProps) {
  return (
    <Window title="Layers" onClose={onClose} class="panel">
      <Choice name="Overlay" options={OVERLAYS} value={overlay} onChange={onOverlay} />
      <Choice name="Zones" options={LEVELS} value={zoneLevel} onChange={onZoneLevel} />
    </Window>
  );
}
