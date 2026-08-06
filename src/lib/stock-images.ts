// Placeholder construction/building photography (Unsplash, free license) used until
// real per-project cover photos exist. Deterministic per id so a given project always
// shows the same image rather than a different one on every render.

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

/** Deterministically pick a stock photo for a given id (e.g. a project id). */
export function imageForId(id: string, width = 800): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return unsplashUrl(STOCK_IMAGE_IDS[h % STOCK_IMAGE_IDS.length], width);
}
