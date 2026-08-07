import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import "leaflet/dist/leaflet.css";
import type { ProjectPin } from "@/lib/project-actions";
import {
  SOUTHERN_AFRICA_CENTER,
  SOUTHERN_AFRICA_ZOOM,
  TILE_ATTRIBUTION,
  colorForProjectStatus,
  pinIcon,
  tileUrlForTheme,
} from "@/lib/map-utils";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

function FitToPins({ pins }: { pins: ProjectPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0].latitude, pins[0].longitude], 11);
      return;
    }
    map.fitBounds(
      pins.map((p) => [p.latitude, p.longitude]),
      { padding: [32, 32], maxZoom: 12 },
    );
  }, [pins, map]);
  return null;
}

export function ProjectsMap({
  pins,
  height = 420,
  scrollWheelZoom = true,
  className,
}: {
  pins: ProjectPin[];
  height?: number | string;
  scrollWheelZoom?: boolean;
  className?: string;
}) {
  // Leaflet touches `window`/`document` at import time, which breaks SSR —
  // defer the actual map to after mount, client-side only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { theme } = useTheme();

  if (!mounted) {
    return (
      <div
        className={cn(
          "as-grain grid place-items-center rounded-xl border border-border bg-surface-2 text-sm text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-border shadow-card", className)}
      style={{ height }}
    >
      <MapContainer
        center={SOUTHERN_AFRICA_CENTER}
        zoom={SOUTHERN_AFRICA_ZOOM}
        scrollWheelZoom={scrollWheelZoom}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={tileUrlForTheme(theme)} detectRetina />
        <FitToPins pins={pins} />
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={pinIcon(colorForProjectStatus(p.status), { pulse: p.status === "active" })}
          >
            <Popup>
              <div className="min-w-[170px]">
                <div className="font-semibold leading-snug">{p.name}</div>
                {p.address && <div className="text-xs text-muted-foreground">{p.address}</div>}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                    style={{
                      color: colorForProjectStatus(p.status),
                      borderColor: colorForProjectStatus(p.status),
                      background: `color-mix(in oklab, ${colorForProjectStatus(p.status)} 15%, transparent)`,
                    }}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <Link
                    to="/projects/$id"
                    params={{ id: p.id }}
                    className="text-xs text-brand hover:underline"
                  >
                    View →
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
