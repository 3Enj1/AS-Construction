import L from "leaflet";

/** Roughly centers South Africa / Southern Africa at a sensible default zoom. */
export const SOUTHERN_AFRICA_CENTER: [number, number] = [-28.5, 24.5];
export const SOUTHERN_AFRICA_ZOOM = 5;

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
 * assets, so it works without shipping/loading Leaflet's default marker PNGs. */
export function pinIcon(color: string, size: "sm" | "md" = "md"): L.DivIcon {
  const w = size === "sm" ? 22 : 28;
  const h = size === "sm" ? 29 : 36;
  return L.divIcon({
    className: "as-map-pin",
    html: `<svg width="${w}" height="${h}" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.35))">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 22 14 22s14-11.5 14-22c0-7.7-6.3-14-14-14z" fill="${color}"/>
      <circle cx="14" cy="14" r="5.5" fill="white"/>
    </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 4],
  });
}
