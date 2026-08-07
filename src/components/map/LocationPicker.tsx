import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import { SOUTHERN_AFRICA_CENTER, SOUTHERN_AFRICA_ZOOM, pinIcon } from "@/lib/map-utils";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Click-to-drop-a-pin location editor — no address search/geocoding, just
 * click where the project is on the map. */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
  height = 240,
  className,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  height?: number | string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hasPin = latitude != null && longitude != null;

  if (!mounted) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-md border border-border bg-surface-2 text-xs text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="overflow-hidden rounded-md border border-border" style={{ height }}>
        <MapContainer
          center={hasPin ? [latitude, longitude] : SOUTHERN_AFRICA_CENTER}
          zoom={hasPin ? 12 : SOUTHERN_AFRICA_ZOOM}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={(lat, lng) => onChange(lat, lng)} />
          {hasPin && <Marker position={[latitude, longitude]} icon={pinIcon("var(--brand)")} />}
        </MapContainer>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {hasPin
            ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            : "Click the map to drop a pin"}
        </span>
        {hasPin && (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="inline-flex items-center gap-1 text-danger hover:underline"
          >
            <X className="size-3" /> Clear pin
          </button>
        )}
      </div>
    </div>
  );
}
