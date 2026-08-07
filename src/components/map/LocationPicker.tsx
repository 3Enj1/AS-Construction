import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  SOUTHERN_AFRICA_CENTER,
  SOUTHERN_AFRICA_ZOOM,
  TILE_ATTRIBUTION,
  geocodeAddress,
  pinIcon,
  tileUrlForTheme,
} from "@/lib/map-utils";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import { Locate, X } from "lucide-react";
import { toast } from "sonner";

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Leaflet's `center` prop only applies on first mount — this recenters the
 * map whenever the pin changes from outside a click (e.g. a geocode result). */
function RecenterOnChange({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    map.flyTo([latitude, longitude], Math.max(map.getZoom(), 13), { duration: 0.8 });
  }, [latitude, longitude, map]);
  return null;
}

/** Click-to-drop-a-pin location editor, with an optional "Locate address"
 * shortcut that geocodes the given address via OpenStreetMap's free Nominatim
 * search and drops the pin there — still adjustable by clicking afterward. */
export function LocationPicker({
  latitude,
  longitude,
  onChange,
  address,
  height = 240,
  className,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  address?: string;
  height?: number | string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => setMounted(true), []);
  const { theme } = useTheme();

  const hasPin = latitude != null && longitude != null;

  const locate = async () => {
    if (!address?.trim()) {
      toast.error("Type a site address first");
      return;
    }
    setLocating(true);
    try {
      const result = await geocodeAddress(address);
      if (!result) {
        toast.error("Couldn't find that address — try clicking the map instead");
        return;
      }
      onChange(result.lat, result.lng);
      toast.success("Pin dropped from address");
    } catch {
      toast.error("Couldn't reach the map service — try clicking the map instead");
    } finally {
      setLocating(false);
    }
  };

  if (!mounted) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-lg border border-border bg-surface-2 text-xs text-muted-foreground",
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
      <div
        className="overflow-hidden rounded-lg border border-border shadow-card"
        style={{ height }}
      >
        <MapContainer
          center={hasPin ? [latitude, longitude] : SOUTHERN_AFRICA_CENTER}
          zoom={hasPin ? 12 : SOUTHERN_AFRICA_ZOOM}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer attribution={TILE_ATTRIBUTION} url={tileUrlForTheme(theme)} detectRetina />
          <ClickToPlace onPick={(lat, lng) => onChange(lat, lng)} />
          <RecenterOnChange latitude={latitude} longitude={longitude} />
          {hasPin && <Marker position={[latitude, longitude]} icon={pinIcon("var(--brand)")} />}
        </MapContainer>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {hasPin
            ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            : "Click the map to drop a pin"}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="inline-flex items-center gap-1 text-brand hover:underline disabled:opacity-50"
          >
            <Locate className="size-3" /> {locating ? "Locating…" : "Locate address"}
          </button>
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
    </div>
  );
}
