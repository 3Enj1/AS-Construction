import { supabase } from "@/integrations/supabase/client";
import type { DiaryEntry } from "@/lib/project-actions";

/** "Friday, 09 Oct 2026". Date-only value parsed as local midnight, not UTC. */
export function formatDiaryDay(entryDate: string): string {
  return new Date(`${entryDate}T00:00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const esc = (v: string | number | null | undefined) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
/** Multi-line text, escaped, with line breaks kept. */
const text = (v: string | null | undefined) =>
  v && v.trim() ? esc(v.trim()).replace(/\r?\n/g, "<br>") : "—";

/** Only embed our own PNG data URLs as signature images. */
const sigImg = (src: string | null) =>
  src && src.startsWith("data:image/png;base64,")
    ? `<img class="sig" src="${src}" alt="Signature">`
    : `<div class="sig-blank"></div>`;

/**
 * Open a printable A4 page for one diary entry in the AS Construction
 * template layout; the browser's Print dialog can save it as a PDF.
 * The window is opened synchronously (inside the click) so phones don't
 * block it as a pop-up, then filled once the project details load.
 */
export async function printDiaryEntry(
  entry: DiaryEntry,
  names: { author?: string; checker?: string; task?: string },
): Promise<void> {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Allow pop-ups for this site to print the diary.");
  win.document.write("<p style='font-family:sans-serif;padding:24px'>Preparing diary…</p>");

  const { data: project } = await supabase
    .from("projects")
    .select("project_name,site_address")
    .eq("id", entry.projectId)
    .maybeSingle();

  const detailRows: [string, string][] = [
    ["Project", text(project?.project_name)],
    ["Site address", text(project?.site_address)],
    ["Date", esc(formatDiaryDay(entry.entryDate))],
    ["Recorded by", text(names.author)],
    ["Working hours", text(entry.workingHours)],
    ["Weather", text(entry.weather)],
  ];
  if (entry.title) detailRows.splice(3, 0, ["Summary", text(entry.title)]);
  if (names.task || entry.taskLabel)
    detailRows.push(["Task / area", text(names.task ?? entry.taskLabel)]);

  const personnel = entry.personnel.length
    ? entry.personnel
        .map(
          (p) =>
            `<tr><td>${text(p.name)}</td><td>${text(p.role)}</td><td>${text(p.hours)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="3" class="muted">None recorded</td></tr>`;

  const subs = entry.subcontractors.length
    ? entry.subcontractors
        .map(
          (s) =>
            `<tr><td>${text(s.trade)}</td><td class="num">${text(s.people)}</td><td>${text(s.hours)}</td><td>${text(s.work)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="muted">None recorded</td></tr>`;

  const materialsUsed = entry.materialsUsed.length
    ? entry.materialsUsed
        .map((m) => `${esc(m.name)} — ${esc(m.qty || "—")}${m.unit ? " " + esc(m.unit) : ""}`)
        .join("<br>")
    : "—";

  const records: [string, string][] = [
    ["Work completed", text(entry.workCompleted)],
    ["Materials delivered", text(entry.materialsDelivered)],
    ["Materials used", materialsUsed],
    ["Plant and equipment", text(entry.plantEquipment)],
    ["Inspections and quality", text(entry.inspections)],
    ["Instructions received", text(entry.instructions)],
    ["Delays and impact", text(entry.issues)],
    ["Health and safety", text(entry.healthSafety)],
    ["Visitors", text(entry.visitors)],
    ["Photographs", text(entry.photographs)],
    ["Next working day", text(entry.nextDay)],
  ];

  const checkedWhen = entry.checkedAt
    ? new Date(entry.checkedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" })
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Daily site diary — ${esc(project?.project_name ?? "")} — ${esc(entry.entryDate)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; margin: 0; padding: 16px; background: #fff; }
  h1 { font-size: 15pt; margin: 0 0 2px; letter-spacing: .02em; }
  h1 span { color: #c8102e; }
  h2 { font-size: 11pt; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #999; padding: 5px 7px; vertical-align: top; text-align: left; }
  th { background: #f1f1f1; font-weight: bold; }
  td.label { width: 32%; font-weight: bold; background: #fafafa; }
  td.num { text-align: center; }
  .muted { color: #777; font-style: italic; }
  .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; page-break-inside: avoid; }
  .sigbox { border: 1px solid #999; padding: 8px; }
  .sigbox .who { font-weight: bold; }
  .sigbox .when { color: #555; font-size: 9pt; }
  .sig { display: block; max-width: 100%; height: 70px; object-fit: contain; margin-top: 6px; }
  .sig-blank { height: 70px; border-bottom: 1px solid #999; margin-top: 6px; }
  .toolbar { margin: 0 0 14px; }
  .toolbar button { font: inherit; padding: 8px 14px; border: 0; border-radius: 6px; background: #c8102e; color: #fff; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1><span>AS CONSTRUCTION</span> — DAILY SITE DIARY</h1>
<table>${detailRows.map(([k, v]) => `<tr><td class="label">${k}</td><td>${v}</td></tr>`).join("")}</table>

<h2>AS Construction personnel on site</h2>
<table><tr><th>Name</th><th>Role</th><th>Hours on site</th></tr>${personnel}</table>

<h2>Subcontractors on site</h2>
<table><tr><th>Trade</th><th>Number of people</th><th>Hours on site</th><th>Work carried out</th></tr>${subs}</table>

<h2>Daily activities and site records</h2>
<table>${records.map(([k, v]) => `<tr><td class="label">${k}</td><td>${v}</td></tr>`).join("")}</table>

<div class="sigs">
  <div class="sigbox"><div>Recorded by</div><div class="who">${text(names.author)}</div>${sigImg(entry.recorderSignature)}</div>
  <div class="sigbox"><div>Checked by</div><div class="who">${entry.checkedBy ? text(names.checker) : "Not yet checked"}</div>
    ${checkedWhen ? `<div class="when">${esc(checkedWhen)}</div>` : ""}${sigImg(entry.checkerSignature)}</div>
</div>
<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 300); });</script>
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
