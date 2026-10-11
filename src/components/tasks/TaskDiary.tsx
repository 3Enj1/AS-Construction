import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { SignaturePad } from "@/components/ui/signature-pad";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import {
  addDiaryEntry,
  deleteDiaryEntry,
  fetchDiaryEntries,
  signOffDiaryEntry,
  type DiaryEntry,
  type DiaryMaterial,
  type DiaryPerson,
  type DiarySubcontractor,
} from "@/lib/project-actions";
import { formatDiaryDay, printDiaryEntry } from "@/lib/diary-print";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  PenLine,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";

/** Local calendar date as YYYY-MM-DD (not UTC), so "today" matches the site's day. */
function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Entry title, falling back to the start of the notes for older untitled entries. */
function diaryTitle(entry: DiaryEntry): string {
  if (entry.title?.trim()) return entry.title.trim();
  const firstLine = entry.workCompleted.split(/\r?\n/)[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

const CAN_CHECK_ROLES = ["admin", "project_manager", "site_supervisor"] as const;

// ============================================================
// Form building blocks
// ============================================================

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-brand">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <Textarea
          id={id}
          rows={2}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

type RowField<T> = {
  key: keyof T & string;
  placeholder: string;
  /** Column span in the row's 6-column grid, e.g. "col-span-6 sm:col-span-2". */
  span: string;
  inputMode?: "numeric" | "decimal";
};

/** Typed table rows (personnel, subcontractors, materials): add / edit / remove. */
function RowsEditor<T extends Record<string, string>>({
  rows,
  onChange,
  fields,
  blank,
  addLabel,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  fields: RowField<T>[];
  blank: T;
  addLabel: string;
}) {
  const set = (i: number, key: keyof T, v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="grid gap-2">
      {rows.map((row, i) => (
        <div
          key={i}
          className="relative grid grid-cols-6 gap-1.5 rounded-md border border-border bg-card p-2 pr-9"
        >
          {fields.map((f) => (
            <Input
              key={f.key}
              aria-label={f.placeholder}
              placeholder={f.placeholder}
              inputMode={f.inputMode}
              value={row[f.key]}
              onChange={(e) => set(i, f.key, e.target.value)}
              className={cn("h-9", f.span)}
            />
          ))}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-0.5 top-1.5 size-8 text-muted-foreground hover:text-danger"
            aria-label="Remove row"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        onClick={() => onChange([...rows, { ...blank }])}
      >
        <Plus className="size-4" /> {addLabel}
      </Button>
    </div>
  );
}

const BLANK_PERSON: DiaryPerson = { name: "", role: "", hours: "" };
const BLANK_SUB: DiarySubcontractor = { trade: "", people: "", hours: "", work: "" };
const BLANK_MATERIAL: DiaryMaterial = { name: "", qty: "", unit: "" };

const PERSON_FIELDS: RowField<DiaryPerson>[] = [
  { key: "name", placeholder: "Name", span: "col-span-6 sm:col-span-2" },
  { key: "role", placeholder: "Role", span: "col-span-3 sm:col-span-2" },
  { key: "hours", placeholder: "07:30–16:30", span: "col-span-3 sm:col-span-2" },
];
const SUB_FIELDS: RowField<DiarySubcontractor>[] = [
  { key: "trade", placeholder: "Trade (e.g. Plumber)", span: "col-span-6 sm:col-span-2" },
  { key: "people", placeholder: "People", span: "col-span-2 sm:col-span-1", inputMode: "numeric" },
  { key: "hours", placeholder: "08:00–15:30", span: "col-span-4 sm:col-span-3" },
  { key: "work", placeholder: "Work carried out", span: "col-span-6" },
];
const MATERIAL_FIELDS: RowField<DiaryMaterial>[] = [
  { key: "name", placeholder: "Material", span: "col-span-6 sm:col-span-3" },
  { key: "qty", placeholder: "Qty", span: "col-span-3 sm:col-span-1", inputMode: "decimal" },
  { key: "unit", placeholder: "Unit", span: "col-span-3 sm:col-span-2" },
];

// ============================================================
// New entry form (AS Construction daily site diary template)
// ============================================================

const EMPTY_TEXT = {
  title: "",
  taskLabel: "",
  workingHours: "",
  weather: "",
  workCompleted: "",
  materialsDelivered: "",
  plantEquipment: "",
  inspections: "",
  instructions: "",
  issues: "",
  healthSafety: "",
  visitors: "",
  photographs: "",
  nextDay: "",
};

function AddDiaryEntryForm({
  taskId: fixedTaskId,
  projectId,
  onDone,
  cancelLabel = "Cancel",
}: {
  /** Lock the entry to one task (task popup). Omit for a project-level entry. */
  taskId?: string;
  projectId: string;
  onDone: () => void;
  cancelLabel?: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [entryDate, setEntryDate] = useState(todayLocal());
  const [t, setT] = useState(EMPTY_TEXT);
  const [personnel, setPersonnel] = useState<DiaryPerson[]>([{ ...BLANK_PERSON }]);
  const [subcontractors, setSubcontractors] = useState<DiarySubcontractor[]>([]);
  const [materials, setMaterials] = useState<DiaryMaterial[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const field = (key: keyof typeof EMPTY_TEXT) => ({
    value: t[key],
    onChange: (v: string) => setT((prev) => ({ ...prev, [key]: v })),
  });

  const add = useMutation({
    mutationFn: () =>
      addDiaryEntry({
        ...t,
        taskId: fixedTaskId ?? null,
        taskLabel: fixedTaskId ? null : t.taskLabel,
        projectId,
        entryDate,
        personnel,
        subcontractors,
        materialsUsed: materials,
        recorderSignature: signature!,
      }),
    onSuccess: () => {
      toast.success("Diary sent");
      qc.invalidateQueries({ queryKey: ["diary"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const missing = [
    !t.title.trim() && "a title",
    !entryDate && "the date",
    !t.workCompleted.trim() && "work completed",
    !signature && "your signature",
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-5 rounded-md border border-border bg-surface-2 p-3 sm:p-4">
      <Section title="Day and site">
        <Field
          id="diary-title"
          label="Title / summary"
          placeholder="e.g. Internal brickwork, ground floor"
          {...field("title")}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="grid content-start gap-1.5">
            <Label htmlFor="diary-date">Date</Label>
            <Input
              id="diary-date"
              type="date"
              value={entryDate}
              max={todayLocal()}
              onChange={(e) => setEntryDate(e.target.value)}
            />
            {entryDate && (
              <span className="text-[11px] text-muted-foreground">{formatDiaryDay(entryDate)}</span>
            )}
          </div>
          <Field
            id="diary-hours"
            label="Working hours"
            placeholder="07:30–16:30"
            {...field("workingHours")}
          />
        </div>
        <Field
          id="diary-weather"
          label="Weather"
          placeholder="e.g. Light rain in the morning; clear from 10:00"
          {...field("weather")}
        />
        {!fixedTaskId && (
          <Field
            id="diary-task"
            label="Task / area (optional)"
            placeholder="e.g. Ground floor walls"
            {...field("taskLabel")}
          />
        )}
      </Section>

      <Section
        title="AS Construction personnel on site"
        hint="List each person separately so there is a clear daily attendance record."
      >
        <RowsEditor
          rows={personnel}
          onChange={setPersonnel}
          fields={PERSON_FIELDS}
          blank={BLANK_PERSON}
          addLabel="Add person"
        />
      </Section>

      <Section title="Subcontractors on site">
        <RowsEditor
          rows={subcontractors}
          onChange={setSubcontractors}
          fields={SUB_FIELDS}
          blank={BLANK_SUB}
          addLabel="Add subcontractor"
        />
      </Section>

      <Section title="Daily activities and site records">
        <Field
          id="diary-work"
          label="Work completed"
          placeholder="What was done on site today?"
          multiline
          {...field("workCompleted")}
        />
        <Field
          id="diary-delivered"
          label="Materials delivered"
          placeholder="What arrived, from whom, when, delivery note filed?"
          multiline
          {...field("materialsDelivered")}
        />
        <div className="grid gap-1.5">
          <Label>Materials used</Label>
          <RowsEditor
            rows={materials}
            onChange={setMaterials}
            fields={MATERIAL_FIELDS}
            blank={BLANK_MATERIAL}
            addLabel="Add material"
          />
        </div>
        <Field
          id="diary-plant"
          label="Plant and equipment"
          placeholder="Equipment used, breakdowns"
          multiline
          {...field("plantEquipment")}
        />
        <Field
          id="diary-inspections"
          label="Inspections and quality"
          placeholder="Checks done, anything corrected"
          multiline
          {...field("inspections")}
        />
        <Field
          id="diary-instructions"
          label="Instructions received"
          placeholder="From architect, client, engineer…"
          multiline
          {...field("instructions")}
        />
        <Field
          id="diary-delays"
          label="Delays and impact"
          placeholder="What held work up and what the crew did instead"
          multiline
          {...field("issues")}
        />
        <Field
          id="diary-hs"
          label="Health and safety"
          placeholder="Toolbox talks, incidents, near misses"
          multiline
          {...field("healthSafety")}
        />
        <Field
          id="diary-visitors"
          label="Visitors"
          placeholder="Who visited and why"
          {...field("visitors")}
        />
        <Field
          id="diary-photos"
          label="Photographs"
          placeholder="e.g. Photos 01–04: internal brickwork"
          multiline
          {...field("photographs")}
        />
        <Field
          id="diary-next"
          label="Next working day"
          placeholder="Planned work for tomorrow"
          multiline
          {...field("nextDay")}
        />
      </Section>

      <Section title="Recorded by">
        <div className="text-sm">
          <span className="font-medium">{user?.name}</span>
          <span className="text-muted-foreground"> — sign below</span>
        </div>
        <SignaturePad onChange={setSignature} />
      </Section>

      <div className="grid gap-2">
        {missing.length > 0 && (
          <p className="text-right text-[11px] text-muted-foreground">
            Still needed: {missing.join(", ")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onDone}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant="brand"
            disabled={missing.length > 0 || add.isPending}
            onClick={() => add.mutate()}
          >
            {add.isPending ? "Sending…" : "Send diary"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Viewing an entry
// ============================================================

function ViewTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60 text-left">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-2 py-1.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-2 py-1.5 align-top">
                  {c || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignatureBlock({
  label,
  name,
  when,
  signature,
}: {
  label: string;
  name?: string;
  when?: string;
  signature: string | null;
}) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{name ?? "—"}</div>
      {when && <div className="text-[11px] text-muted-foreground">{when}</div>}
      {signature ? (
        <img
          src={signature}
          alt={`${label} signature`}
          className="mt-1 h-16 w-full rounded bg-white object-contain"
        />
      ) : (
        <div className="mt-1 grid h-16 place-items-center rounded bg-muted/40 text-[11px] text-muted-foreground">
          No signature
        </div>
      )}
    </div>
  );
}

function SignOffDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: DiaryEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [signature, setSignature] = useState<string | null>(null);
  const sign = useMutation({
    mutationFn: () => signOffDiaryEntry(entry.id, signature!),
    onSuccess: () => {
      toast.success("Diary checked and signed");
      qc.invalidateQueries({ queryKey: ["diary"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign as checker</DialogTitle>
          <DialogDescription>
            {diaryTitle(entry)} · {formatDiaryDay(entry.entryDate)}
          </DialogDescription>
        </DialogHeader>
        <div className="text-sm">
          Checked by <span className="font-medium">{user?.name}</span>
        </div>
        {open && <SignaturePad onChange={setSignature} />}
        <DialogFooter>
          <Button
            variant="brand"
            disabled={!signature || sign.isPending}
            onClick={() => sign.mutate()}
          >
            <PenLine className="size-4" /> {sign.isPending ? "Signing…" : "Sign and mark checked"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiaryEntryView({
  entry,
  taskTitle,
  onDeleted,
}: {
  entry: DiaryEntry;
  taskTitle?: string;
  onDeleted: () => void;
}) {
  const { user, hasRole, allUsers } = useAuth();
  const [signing, setSigning] = useState(false);
  const remove = useDeleteDiaryEntry();
  const author = allUsers.find((u) => u.id === entry.authorId);
  const checker = entry.checkedBy ? allUsers.find((u) => u.id === entry.checkedBy) : undefined;
  const canDelete = entry.authorId === user?.id || hasRole("admin");
  const canCheck = !entry.checkedBy && hasRole(...CAN_CHECK_ROLES);
  const task = taskTitle ?? entry.taskLabel ?? undefined;

  const details: [string, string | null | undefined][] = [
    ["Date", formatDiaryDay(entry.entryDate)],
    ["Working hours", entry.workingHours],
    ["Weather", entry.weather],
    ["Task / area", task],
  ];
  const records: [string, string | null | undefined][] = [
    ["Work completed", entry.workCompleted],
    ["Materials delivered", entry.materialsDelivered],
    ["Plant and equipment", entry.plantEquipment],
    ["Inspections and quality", entry.inspections],
    ["Instructions received", entry.instructions],
    ["Delays and impact", entry.issues],
    ["Health and safety", entry.healthSafety],
    ["Visitors", entry.visitors],
    ["Photographs", entry.photographs],
    ["Next working day", entry.nextDay],
  ];

  const print = async () => {
    try {
      await printDiaryEntry(entry, { author: author?.name, checker: checker?.name, task });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the print view");
    }
  };

  return (
    <div className="grid gap-4 text-sm">
      <div className="flex items-start gap-2">
        {author && <UserAvatar user={author} size={28} />}
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{diaryTitle(entry)}</div>
          <div className="text-xs text-muted-foreground">
            {formatDiaryDay(entry.entryDate)} · recorded by {author?.name ?? "Unknown"}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {details
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>

      {entry.personnel.length > 0 && (
        <div className="grid gap-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">
            AS Construction personnel on site
          </h4>
          <ViewTable
            head={["Name", "Role", "Hours on site"]}
            rows={entry.personnel.map((p) => [p.name, p.role, p.hours])}
          />
        </div>
      )}
      {entry.subcontractors.length > 0 && (
        <div className="grid gap-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">
            Subcontractors on site
          </h4>
          <ViewTable
            head={["Trade", "People", "Hours", "Work carried out"]}
            rows={entry.subcontractors.map((s) => [s.trade, s.people, s.hours, s.work])}
          />
        </div>
      )}
      {(entry.workersOnSite != null || entry.hoursWorked != null) && (
        <div className="flex gap-4 text-xs text-muted-foreground">
          {entry.workersOnSite != null && <span>{entry.workersOnSite} on site</span>}
          {entry.hoursWorked != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {entry.hoursWorked} h
            </span>
          )}
        </div>
      )}

      <div className="grid gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-brand">
          Daily activities and site records
        </h4>
        <div className="divide-y divide-border rounded-md border border-border">
          {records
            .filter(([, v]) => v && v.trim())
            .map(([k, v]) => (
              <div key={k} className="grid gap-0.5 px-2 py-1.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
                <div className="text-xs font-semibold">{k}</div>
                <div
                  className={cn(
                    "whitespace-pre-wrap text-xs",
                    k === "Delays and impact" && "text-warning",
                  )}
                >
                  {v}
                </div>
              </div>
            ))}
          {entry.materialsUsed.length > 0 && (
            <div className="grid gap-1 px-2 py-1.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
              <div className="text-xs font-semibold">Materials used</div>
              <ul className="text-xs">
                {entry.materialsUsed.map((m, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{m.name}</span>
                    <span className="font-medium tabular-nums">
                      {m.qty || "—"}
                      {m.unit ? ` ${m.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <SignatureBlock
          label="Recorded by"
          name={author?.name}
          signature={entry.recorderSignature}
        />
        <SignatureBlock
          label="Checked by"
          name={entry.checkedBy ? (checker?.name ?? "Unknown") : "Not yet checked"}
          when={
            entry.checkedAt
              ? new Date(entry.checkedAt).toLocaleString("en-ZA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : undefined
          }
          signature={entry.checkerSignature}
        />
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {canDelete && (
          <Button
            size="sm"
            variant="outline"
            className="border-danger/40 text-danger hover:bg-danger/10"
            disabled={remove.isPending}
            onClick={() => remove.mutate(entry.id, { onSuccess: onDeleted })}
          >
            <Trash2 className="size-4" /> Delete
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={print}>
          <Printer className="size-4" /> Print / Save PDF
        </Button>
        {canCheck && (
          <Button size="sm" variant="brand" onClick={() => setSigning(true)}>
            <PenLine className="size-4" /> Sign as checker
          </Button>
        )}
      </div>

      <SignOffDialog entry={entry} open={signing} onOpenChange={setSigning} />
    </div>
  );
}

function useDeleteDiaryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDiaryEntry,
    onSuccess: () => {
      toast.success("Diary entry deleted");
      qc.invalidateQueries({ queryKey: ["diary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Rows of "title + day/date" that open the full entry. */
function DiaryEntryList({
  entries,
  taskTitles,
  className,
}: {
  entries: DiaryEntry[];
  taskTitles?: Map<string, string>;
  className?: string;
}) {
  const { allUsers } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const openEntry = entries.find((e) => e.id === openId) ?? null;
  const taskFor = (e: DiaryEntry) =>
    e.taskId
      ? (taskTitles?.get(e.taskId) ?? (taskTitles ? "Archived task" : undefined))
      : (e.taskLabel ?? undefined);

  return (
    <>
      <div className={cn("divide-y divide-border", className)}>
        {entries.map((e) => {
          const author = allUsers.find((u) => u.id === e.authorId);
          const task = taskFor(e);
          return (
            <button
              key={e.id}
              onClick={() => setOpenId(e.id)}
              className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-accent as-press sm:px-4"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
                <BookOpen className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{diaryTitle(e)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatDiaryDay(e.entryDate)}
                  {author ? ` · ${author.name.split(" ")[0]}` : ""}
                  {task ? ` · ${task}` : ""}
                </div>
              </div>
              {e.checkedBy ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Checked" />
              ) : (
                <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                  Unchecked
                </span>
              )}
              {e.issues && (
                <AlertTriangle className="size-4 shrink-0 text-warning" aria-label="Has delays" />
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <Dialog open={!!openEntry} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-brand" /> Daily site diary
            </DialogTitle>
          </DialogHeader>
          {openEntry && (
            <DiaryEntryView
              entry={openEntry}
              taskTitle={taskFor(openEntry)}
              onDeleted={() => setOpenId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// Exported sections
// ============================================================

/** Daily diary for one task (inside the task popup): add an entry and see past ones. */
export function TaskDiarySection({
  taskId,
  projectId,
  canWrite,
}: {
  taskId: string;
  projectId: string;
  canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["diary", "task", taskId],
    queryFn: () => fetchDiaryEntries({ taskId }),
  });

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <BookOpen className="size-3.5" /> Daily diary
        </div>
        {canWrite && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add today's entry
          </Button>
        )}
        {adding && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={() => setAdding(false)}
            aria-label="Close diary form"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      {adding && (
        <div className="mt-2">
          <AddDiaryEntryForm
            taskId={taskId}
            projectId={projectId}
            onDone={() => setAdding(false)}
          />
        </div>
      )}
      <div className="mt-2">
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading diary…</div>
        ) : entries.length === 0 ? (
          <div className="text-xs text-muted-foreground">No diary entries yet.</div>
        ) : (
          <DiaryEntryList entries={entries} className="rounded-md border border-border" />
        )}
      </div>
    </div>
  );
}

/** Every diary entry across a project (project-level and task-linked), newest day first. */
export function ProjectDiary({
  projectId,
  taskTitles,
}: {
  projectId: string;
  taskTitles: Map<string, string>;
}) {
  const { data: entries = [], isLoading, isError, error } = useProjectDiary(projectId);

  if (isLoading)
    return <div className="as-card p-6 text-sm text-muted-foreground">Loading diary…</div>;
  if (isError)
    return (
      <div className="as-card p-6 text-sm text-danger">
        Couldn't load the diary: {error instanceof Error ? error.message : "Unknown error"}
      </div>
    );
  if (entries.length === 0)
    return (
      <div className="as-card p-6 text-sm text-muted-foreground">
        No diary entries yet. Use the Daily diary button above to send the first one.
      </div>
    );

  return <DiaryEntryList entries={entries} taskTitles={taskTitles} className="as-card" />;
}

/** Project diary entries, shared by the Diary tab, the header button and the reminder. */
export function useProjectDiary(projectId: string, enabled = true) {
  return useQuery({
    queryKey: ["diary", "project", projectId],
    queryFn: () => fetchDiaryEntries({ projectId }),
    enabled,
  });
}

/** True once loaded if nobody has sent a diary entry for this project today. */
export function useDiaryMissingToday(projectId: string, enabled: boolean): boolean {
  const { data, isSuccess } = useProjectDiary(projectId, enabled);
  if (!enabled || !isSuccess) return false;
  const today = todayLocal();
  return !data.some((e) => e.entryDate === today);
}

const SNOOZE_KEY = (projectId: string) => `as-diary-snooze:${projectId}`;

/** "Remind me later" hides the reminder for this project until tomorrow (this browser only). */
export function isDiaryReminderSnoozed(projectId: string): boolean {
  try {
    return localStorage.getItem(SNOOZE_KEY(projectId)) === todayLocal();
  } catch {
    return false;
  }
}

function snoozeDiaryReminder(projectId: string) {
  try {
    localStorage.setItem(SNOOZE_KEY(projectId), todayLocal());
  } catch {
    // storage unavailable (private mode) — the reminder just shows again next visit
  }
}

/** The project's daily diary form in a pop-up. `reminder` adds the "not sent yet" nudge. */
export function DailyDiaryDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  reminder = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  reminder?: boolean;
}) {
  const close = () => {
    if (reminder) snoozeDiaryReminder(projectId);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-brand" /> Daily site diary
          </DialogTitle>
          <DialogDescription>{projectName}</DialogDescription>
        </DialogHeader>
        {reminder && (
          <div className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>Today's diary hasn't been sent for this project yet.</span>
          </div>
        )}
        <AddDiaryEntryForm
          projectId={projectId}
          onDone={close}
          cancelLabel={reminder ? "Remind me later" : "Cancel"}
        />
      </DialogContent>
    </Dialog>
  );
}
