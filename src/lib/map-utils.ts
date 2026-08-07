import L from "leaflet";
import type { Theme } from "./theme-context";

/** Roughly centers South Africa / Southern Africa at a sensible default zoom. */
export const SOUTHERN_AFRICA_CENTER: [number, number] = [-28.5, 24.5];
export const SOUTHERN_AFRICA_ZOOM = 5;

/** CARTO's free basemap tiles — no API key, and far less flat/grey than the
 * stock OpenStreetMap raster style. Voyager for light mode, Dark Matter for
 * dark mode, so the map actually matches the app's theme instead of always
 * rendering a plain daylight map. */
export function tileUrlForTheme(theme: Theme): string {
  return theme === "dark"
    ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
}

export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function colorForProjectStatus(status: string): string {
  switch (status) {
    case "completed":
      return "var(--success)";
    case "on_hold":
      return "var(--warning)";
    case "cancelled":
    case "archived":
      return "var(--muted-foreground)";
    case "active":
      return "var(--brand)";
    default:
      return "var(--info)"; // planning
  }
}

/** A brand-styled teardrop pin as an inline SVG divIcon — no external image
 * assets, so it works without shipping/loading Leaflet's default marker PNGs.
 * Active projects get a soft pulsing halo so the map reads as "alive". */
export function pinIcon(
  color: string,
  opts: { size?: "sm" | "md"; pulse?: boolean } = {},
): L.DivIcon {
  const { size = "md", pulse = false } = opts;
  const w = size === "sm" ? 22 : 28;
  const h = size === "sm" ? 29 : 36;
  return L.divIcon({
    className: "as-map-pin",
    html: `<div style="position:relative;width:${w}px;height:${h}px;">
      ${
        pulse
          ? `<span class="as-map-pin-pulse" style="background:${color};width:${w * 0.9}px;height:${w * 0.9}px;left:${w * 0.05}px;bottom:-2px;"></span>`
          : ""
      }
      <svg width="${w}" height="${h}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="position:relative;filter: drop-shadow(0 3px 4px rgb(0 0 0 / 0.45))">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.7-6.3-14-14-14z" fill="${color}"/>
        <circle cx="14" cy="14" r="5.5" fill="white"/>
      </svg>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 4],
  });
}

export type GeocodeResult = { lat: number; lng: number; label: string };

/** Address → coordinates via OpenStreetMap's free Nominatim search — no API
 * key. Best-effort: returns null on no match or network failure rather than
 * throwing, since this is a convenience on top of manual pin placement. */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(trimmed)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!results.length) return null;
    const r = results[0];
    return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: r.display_name };
  } catch {
    return null;
  }
}
