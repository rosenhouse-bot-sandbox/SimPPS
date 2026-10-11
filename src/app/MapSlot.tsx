import type { Household, SchoolId, SchoolState } from '../sim/types';

export type Overlay = 'none' | 'seats' | 'families';
export type ZoneLevel = 'elementary' | 'middle' | 'high';

export interface MapSlotProps {
  schools: Record<SchoolId, SchoolState>;
  households: Household[];
  overlay: Overlay;
  selected: SchoolId | null;
  onSelectSchool: (id: SchoolId | null) => void;
  zoneLevel: ZoneLevel;
}

/** The integrator replaces this body with `<MapView {...props} />` from src/map. */
export function MapSlot({ overlay, zoneLevel, selected }: MapSlotProps) {
  return (
    <div class="map-slot" data-testid="map-slot" data-overlay={overlay} data-zone-level={zoneLevel} data-selected={selected ?? ''}>
      <p class="note">The map loads here. Plan → Schools A–Z opens any school.</p>
    </div>
  );
}
