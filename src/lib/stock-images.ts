// Placeholder construction/building photography (Unsplash, free license) used until
// real per-project/material photos exist. Picks are deterministic per id so a given
// item always shows the same image rather than a different one on every render.

const STOCK_IMAGE_IDS = [
  "1566766804418-9090a2caebd6", // tower crane against the sky
  "1609867271967-a82f85c48531", // panoramic building construction site
  "1660367439240-d38cb03a4365", // construction site with crane
  "1759912497669-f2b90b1d3fec", // crane and buildings, city construction site
  "1750061587460-7dbf12d2fdd7", // construction cranes working on building projects
  "1768638687896-35bde623d532", // modern apartment building exterior
  "1587582423116-ec07293f0395", // worker in hard hat on a house frame
];

function unsplashUrl(id: string, width: number) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=70`;
}

/** Deterministically pick a generic construction/building photo for a given id (e.g. a project id). */
export function imageForId(id: string, width = 800): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return unsplashUrl(STOCK_IMAGE_IDS[h % STOCK_IMAGE_IDS.length], width);
}

// ---- Project template categories ----
// One curated photo per template category, matching the phase-type the template
// represents (kitchen remodel templates get a kitchen photo, not a generic crane shot).

const TEMPLATE_CATEGORY_IMAGE_IDS: Record<string, string> = {
  residential_build: "1768638687896-35bde623d532", // modern apartment building exterior
  renovation: "1517581177682-a085bb7ffb15", // man on ladder working inside a room
  kitchen_bath: "1502005097973-6a7082348e28", // modern kitchen island
  roofing: "1549213836-c8ca4a27d113", // corrugated roofing sheet
  commercial: "1759912497669-f2b90b1d3fec", // crane and buildings, city construction site
  extension: "1754063257992-bb9eabdbdd86", // modern home extension with large windows
  general: "1609867271967-a82f85c48531", // panoramic building construction site
};

export function imageForTemplateCategory(category: string, width = 800): string {
  const id = TEMPLATE_CATEGORY_IMAGE_IDS[category] ?? TEMPLATE_CATEGORY_IMAGE_IDS.general;
  return unsplashUrl(id, width);
}

// ---- Material type icons ----
// Small representative photo per material type, matched by keyword against the
// material's name/category (both free text). Returns null when nothing matches,
// so callers can fall back to a neutral icon instead of showing a misleading photo.

const MATERIAL_KEYWORD_IMAGES: { keywords: string[]; id: string }[] = [
  { keywords: ["cement"], id: "1773394089934-3e29f2a3d6a9" }, // stacked cement bags
  { keywords: ["brick", "block"], id: "1547056961-3c25e9140b05" }, // brick wall
  { keywords: ["sand", "aggregate", "gravel", "stone", "concrete"], id: "1681880511033-b9582a379ce2" }, // sand & cement piles
  { keywords: ["steel", "rebar", "iron", "metal"], id: "1763771420303-0f11ccf613d1" }, // bundled rebar
  { keywords: ["timber", "wood", "lumber", "plank"], id: "1546484396-fb3fc6f95f98" }, // wooden boards
  { keywords: ["roof", "sheeting", "sheet"], id: "1549213836-c8ca4a27d113" }, // corrugated roofing sheet
  { keywords: ["paint"], id: "1670940094923-6f75e4dc5c3a" }, // paint can and brush
  { keywords: ["pipe", "plumbing", "pvc"], id: "1729169927271-7826d8aae360" }, // stacked pipes
  { keywords: ["electric", "cable", "wire", "wiring"], id: "1555963966-b7ae5404b6ed" }, // electrical cable
  { keywords: ["tile", "flooring", "ceramic"], id: "1523350165414-082d792c4bcc" }, // ceramic tiles
];

export function imageForMaterial(name: string, category: string, width = 100): string | null {
  const haystack = `${name} ${category}`.toLowerCase();
  const match = MATERIAL_KEYWORD_IMAGES.find((m) => m.keywords.some((k) => haystack.includes(k)));
  return match ? unsplashUrl(match.id, width) : null;
}
