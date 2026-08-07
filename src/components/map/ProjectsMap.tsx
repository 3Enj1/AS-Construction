import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import "leaflet/dist/leaflet.css";
import type { ProjectPin } from "@/lib/project-actions";
import {
  SOUTHERN_AFRICA_CENTER,
  SOUTHERN_AFRICA_ZOOM,
  colorForProjectStatus,
  pinIcon,
} from "@/lib/map-utils";
import { cn } from "@/lib/utils";

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

  if (!mounted) {
    return (
      <div
        className={cn(
          "grid place-items-center rounded-lg border border-border bg-surface-2 text-sm text-muted-foreground",
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
      className={cn("overflow-hidden rounded-lg border border-border", className)}
      style={{ height }}
    >
      <MapContainer
        center={SOUTHERN_AFRICA_CENTER}
        zoom={SOUTHERN_AFRICA_ZOOM}
        scrollWheelZoom={scrollWheelZoom}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPins pins={pins} />
        {pins.map((p) => (
          <Marker
            key={p.id}
            position={[p.latitude, p.longitude]}
            icon={pinIcon(colorForProjectStatus(p.status))}
          >
            <Popup>
              <div className="min-w-[160px]">
                <div className="font-semibold leading-snug">{p.name}</div>
                {p.address && <div className="text-xs text-muted-foreground">{p.address}</div>}
                <Link
                  to="/projects/$id"
                  params={{ id: p.id }}
                  className="mt-1 inline-block text-xs text-brand hover:underline"
                >
                  View project →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
