import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";
import {
  addDiaryEntry,
  deleteDiaryEntry,
  fetchDiaryEntries,
  type DiaryEntry,
} from "@/lib/project-actions";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Clock,
  CloudSun,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";

const WEATHER_OPTIONS = ["Sunny", "Partly cloudy", "Overcast", "Rain", "Windy", "Storm"];

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

/** Date-only value: parse as local midnight, not UTC, so it can't shift a day. */
function formatEntryDate(entryDate: string): string {
  return formatDate(`${entryDate}T00:00:00`);
}

function DiaryEntryCard({
  entry,
  taskTitle,
  onDelete,
  deleting,
}: {
  entry: DiaryEntry;
  taskTitle?: string;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const { allUsers } = useAuth();
  const author = allUsers.find((u) => u.id === entry.authorId);
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {author && <UserAvatar user={author} size={24} />}
          <div className="min-w-0">
            <div className="truncate font-medium">{author?.name ?? "Unknown"}</div>
            <div className="text-[11px] text-muted-foreground">
              {formatEntryDate(entry.entryDate)}
              {taskTitle ? ` · ${taskTitle}` : ""}
            </div>
          </div>
        </div>
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0 text-muted-foreground hover:text-danger"
            disabled={deleting}
            onClick={onDelete}
            aria-label="Delete diary entry"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="mt-2 font-semibold">{diaryTitle(entry)}</div>
      <div className="mt-1 whitespace-pre-wrap">{entry.workCompleted}</div>
      {(entry.weather || entry.workersOnSite != null || entry.hoursWorked != null) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {entry.weather && (
            <span className="inline-flex items-center gap-1">
              <CloudSun className="size-3.5" /> {entry.weather}
            </span>
          )}
          {entry.workersOnSite != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> {entry.workersOnSite} on site
            </span>
          )}
          {entry.hoursWorked != null && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {entry.hoursWorked} h
            </span>
          )}
        </div>
      )}
      {entry.issues && (
        <div className="mt-2 flex gap-1.5 rounded-md bg-warning/10 px-2 py-1.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span className="whitespace-pre-wrap">{entry.issues}</span>
        </div>
      )}
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

function AddDiaryEntryForm({
  taskId: fixedTaskId,
  projectId,
  tasks,
  onDone,
  cancelLabel = "Cancel",
}: {
  /** Lock the entry to one task (task popup). Omit for a project-level entry. */
  taskId?: string;
  projectId: string;
  /** Project-level form only: lets the writer optionally link a task. */
  tasks?: { id: string; title: string }[];
  onDone: () => void;
  cancelLabel?: string;
}) {
  const qc = useQueryClient();
  const [linkedTaskId, setLinkedTaskId] = useState("none");
  const [title, setTitle] = useState("");
  const [entryDate, setEntryDate] = useState(todayLocal());
  const [workCompleted, setWorkCompleted] = useState("");
  const [weather, setWeather] = useState("none");
  const [workers, setWorkers] = useState("");
  const [hours, setHours] = useState("");
  const [issues, setIssues] = useState("");

  const add = useMutation({
    mutationFn: () =>
      addDiaryEntry({
        taskId: fixedTaskId ?? (linkedTaskId === "none" ? null : linkedTaskId),
        projectId,
        entryDate,
        title: title.trim(),
        workCompleted: workCompleted.trim(),
        weather: weather === "none" ? null : weather,
        workersOnSite: workers.trim() ? Number(workers) : null,
        hoursWorked: hours.trim() ? Number(hours) : null,
        issues: issues.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Diary entry saved");
      qc.invalidateQueries({ queryKey: ["diary"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-3 rounded-md border border-border bg-surface-2 p-3">
      <div className="grid gap-1.5">
        <Label htmlFor="diary-title">Title</Label>
        <Input
          id="diary-title"
          placeholder="e.g. Foundations poured, east wall"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="diary-date">Date</Label>
          <Input
            id="diary-date"
            type="date"
            value={entryDate}
            max={todayLocal()}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Weather</Label>
          <Select value={weather} onValueChange={setWeather}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not recorded</SelectItem>
              {WEATHER_OPTIONS.map((w) => (
                <SelectItem key={w} value={w}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {!fixedTaskId && tasks && tasks.length > 0 && (
        <div className="grid gap-1.5">
          <Label>Task (optional)</Label>
          <Select value={linkedTaskId} onValueChange={setLinkedTaskId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Whole project</SelectItem>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="diary-work">Work completed today</Label>
        <Textarea
          id="diary-work"
          rows={3}
          placeholder={
            fixedTaskId ? "What was done on this task today?" : "What was done on site today?"
          }
          value={workCompleted}
          onChange={(e) => setWorkCompleted(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="diary-workers">Workers on site</Label>
          <Input
            id="diary-workers"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={workers}
            onChange={(e) => setWorkers(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="diary-hours">Hours worked</Label>
          <Input
            id="diary-hours"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="diary-issues">Issues / delays (optional)</Label>
        <Textarea
          id="diary-issues"
          rows={2}
          placeholder="Hold-ups, safety incidents, missing materials…"
          value={issues}
          onChange={(e) => setIssues(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onDone}>
          {cancelLabel}
        </Button>
        <Button
          size="sm"
          variant="brand"
          disabled={!title.trim() || !workCompleted.trim() || !entryDate || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? "Sending…" : "Send diary"}
        </Button>
      </div>
    </div>
  );
}

/** Daily diary for one task: add an entry (if allowed) and see past entries. */
export function TaskDiarySection({
  taskId,
  projectId,
  canWrite,
}: {
  taskId: string;
  projectId: string;
  canWrite: boolean;
}) {
  const { user, hasRole } = useAuth();
  const [adding, setAdding] = useState(false);
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["diary", "task", taskId],
    queryFn: () => fetchDiaryEntries({ taskId }),
  });
  const remove = useDeleteDiaryEntry();

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
      <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading diary…</div>
        ) : entries.length === 0 ? (
          <div className="text-xs text-muted-foreground">No diary entries yet.</div>
        ) : (
          entries.map((e) => (
            <DiaryEntryCard
              key={e.id}
              entry={e}
              deleting={remove.isPending}
              onDelete={
                e.authorId === user?.id || hasRole("admin") ? () => remove.mutate(e.id) : undefined
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Every diary entry across a project's tasks, newest day first. */
export function ProjectDiary({
  projectId,
  taskTitles,
}: {
  projectId: string;
  taskTitles: Map<string, string>;
}) {
  const { user, hasRole, allUsers } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: entries = [], isLoading, isError, error } = useProjectDiary(projectId);
  const remove = useDeleteDiaryEntry();
  const openEntry = entries.find((e) => e.id === openId) ?? null;

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

  return (
    <>
      <div className="as-card divide-y divide-border">
        {entries.map((e) => {
          const author = allUsers.find((u) => u.id === e.authorId);
          const taskTitle = e.taskId ? (taskTitles.get(e.taskId) ?? "Archived task") : null;
          return (
            <button
              key={e.id}
              onClick={() => setOpenId(e.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent as-press"
            >
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-brand/10 text-brand">
                <BookOpen className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{diaryTitle(e)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatEntryDate(e.entryDate)}
                  {author ? ` · ${author.name.split(" ")[0]}` : ""}
                  {taskTitle ? ` · ${taskTitle}` : ""}
                </div>
              </div>
              {e.issues && (
                <AlertTriangle className="size-4 shrink-0 text-warning" aria-label="Has issues" />
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      <Dialog open={!!openEntry} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-brand" /> Diary entry
            </DialogTitle>
          </DialogHeader>
          {openEntry && (
            <DiaryEntryCard
              entry={openEntry}
              taskTitle={
                openEntry.taskId
                  ? (taskTitles.get(openEntry.taskId) ?? "Archived task")
                  : "Whole project"
              }
              deleting={remove.isPending}
              onDelete={
                openEntry.authorId === user?.id || hasRole("admin")
                  ? () => remove.mutate(openEntry.id, { onSuccess: () => setOpenId(null) })
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
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
  tasks,
  reminder = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  tasks: { id: string; title: string }[];
  reminder?: boolean;
}) {
  const close = () => {
    if (reminder) snoozeDiaryReminder(projectId);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-brand" /> Daily diary
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
          tasks={tasks}
          onDone={close}
          cancelLabel={reminder ? "Remind me later" : "Cancel"}
        />
      </DialogContent>
    </Dialog>
  );
}
