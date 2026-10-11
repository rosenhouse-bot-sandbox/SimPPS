import { MapView, type MapViewProps } from '../map';

export type { MapZoneLevel, Overlay } from '../map';

/** The map fills the stage behind every panel. */
export function MapSlot(props: MapViewProps) {
  return (
    <div class="map-slot">
      <MapView {...props} />
    </div>
  );
}
