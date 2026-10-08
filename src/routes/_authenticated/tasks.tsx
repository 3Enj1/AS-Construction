import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskCard } from "@/components/tasks/TaskCard";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { createTaskSuggestion, fetchEnrichedTasks, fetchProjectsMini } from "@/lib/project-actions";
import type { DbPriority } from "@/lib/task-mapper";
import type { EnrichedTask } from "@/lib/task-mapper";
import type { TaskStatus } from "@/lib/types";
import { Camera, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  {
    key: "review",
    label: "Awaiting review",
    match: (s: TaskStatus) => s === "Submitted for Review",
  },
  { key: "overdue", label: "Overdue", match: (s: TaskStatus) => s === "Overdue" },
  {
    key: "active",
    label: "Active",
    match: (s: TaskStatus) => ["In Progress", "Assigned", "Not Started"].includes(s),
  },
  {
    key: "blocked",
    label: "Blocked",
    match: (s: TaskStatus) => ["Blocked", "Awaiting Materials"].includes(s),
  },
  { key: "done", label: "Done", match: (s: TaskStatus) => s === "Approved" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

// Most urgent first: waiting on a reviewer, then overdue, blocked, in-flight, done last.
const STATUS_RANK: Partial<Record<TaskStatus, number>> = {
  "Submitted for Review": 0,
  Overdue: 1,
  Blocked: 2,
  "Awaiting Materials": 2,
  Rejected: 3,
  "In Progress": 4,
  Assigned: 5,
  "Not Started": 6,
  Approved: 9,
};
function compareTasks(a: EnrichedTask, b: EnrichedTask): number {
  const r = (STATUS_RANK[a.status] ?? 7) - (STATUS_RANK[b.status] ?? 7);
  if (r !== 0) return r;
  // then soonest due date, undated last
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
  return a.dueDate ? -1 : b.dueDate ? 1 : 0;
}

type TasksSearch = { task?: string; status?: FilterKey };

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
  // ?task=<id> opens that task straight away (links from notifications and
  // dashboards); ?status=<filter> preselects a status filter.
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    task: typeof search.task === "string" ? search.task : undefined,
    status: FILTERS.some((f) => f.key === search.status) ? (search.status as FilterKey) : undefined,
  }),
});

function TasksPage() {
  const { user, allUsers, hasRole } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [editTask, setEditTask] = useState<EnrichedTask | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const isWorkerLike = user?.role === "worker" || user?.role === "subcontractor";
  const canManage = hasRole("admin", "project_manager", "site_supervisor");
  const { task: taskFromSearch, status: statusFromSearch } = Route.useSearch();
  const filter: FilterKey = statusFromSearch ?? "all";
  const navigate = useNavigate();
  // Status filter lives in the URL so dashboard cards can link straight to it.
  const setFilter = (key: FilterKey) =>
    navigate({
      to: "/tasks",
      search: (prev) => ({ ...prev, status: key === "all" ? undefined : key }),
      replace: true,
      resetScroll: false,
    });

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks", isWorkerLike ? `assigned:${user?.id}` : "all"],
    queryFn: () => fetchEnrichedTasks(isWorkerLike ? { assignedToProfileId: user!.id } : undefined),
    enabled: !!user,
  });

  // Deep link: once tasks are loaded, open the linked task and drop the param
  // so closing the popup (or refreshing) doesn't reopen it.
  const handledLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!taskFromSearch || isLoading || handledLinkRef.current === taskFromSearch) return;
    handledLinkRef.current = taskFromSearch;
    const found = tasks.find((t) => t.id === taskFromSearch);
    if (found) setEditTask(found);
    else toast.error("That task is no longer available.");
    navigate({
      to: "/tasks",
      search: (prev) => ({ ...prev, task: undefined }),
      replace: true,
      resetScroll: false,
    });
  }, [taskFromSearch, isLoading, tasks, navigate]);

  // Picker options come from the tasks themselves, so only relevant ones show.
  const projectOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) if (t.projectId) m.set(t.projectId, t.projectName ?? "Untitled project");
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);
  const personOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) {
      const a = t.assignees[0];
      if (t.assignedUserId && a) m.set(t.assignedUserId, a.name);
    }
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  if (!user) return null;

  // Project / person / search narrow the pool; the status chips (with counts)
  // then pick from that pool.
  const q = query.trim().toLowerCase();
  const pool = tasks.filter(
    (t) =>
      (projectFilter === "all" || t.projectId === projectFilter) &&
      (personFilter === "all" ||
        (personFilter === "unassigned" ? !t.assignedUserId : t.assignedUserId === personFilter)) &&
      (!q ||
        [t.title, t.projectName, t.phaseName, t.assignees[0]?.name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))),
  );
  const activeFilter = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const list: EnrichedTask[] = pool.filter((t) => activeFilter.match(t.status)).sort(compareTasks);
  const extraFilters = projectFilter !== "all" || personFilter !== "all" || !!q;

  return (
    <>
      <PageHeader
        title={isWorkerLike ? "My tasks" : "Tasks"}
        subtitle={`${list.length} of ${tasks.length} tasks`}
        actions={
          // Workers/subcontractors only work on tasks they're given — they can't add any.
          !isWorkerLike && (
            <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="size-4" /> Add new task
                </Button>
              </DialogTrigger>
              <SuggestTaskDialog onDone={() => setSuggestOpen(false)} />
            </Dialog>
          )
        }
      />
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, people…"
            className="h-10 pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          {projectOptions.length > 1 && (
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-10 sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projectOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!isWorkerLike && (
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="h-10 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {personOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === "all" ? pool.length : pool.filter((t) => f.match(t.status)).length;
          const selected = filter === f.key;
          return (
            <Button
              key={f.key}
              variant={selected ? "brand" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span
                className={
                  "rounded-full px-1.5 text-[10px] font-semibold " +
                  (selected
                    ? "bg-brand-foreground/25"
                    : f.key === "review" && count > 0
                      ? "bg-warning text-warning-foreground"
                      : "bg-muted text-muted-foreground")
                }
              >
                {count}
              </span>
            </Button>
          );
        })}
        {extraFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setQuery("");
              setProjectFilter("all");
              setPersonFilter("all");
            }}
          >
            <X className="size-3.5" /> Clear filters
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading tasks…</div>
      ) : error ? (
        <div className="as-card p-6 text-sm text-danger">Error loading tasks.</div>
      ) : list.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">No tasks for this filter.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => setEditTask(t)} />
          ))}
        </div>
      )}

      {editTask && (
        <EditTaskDialog
          task={editTask}
          assignableUsers={allUsers.filter((u) => ["worker", "subcontractor"].includes(u.role))}
          supervisors={allUsers.filter((u) => u.role === "site_supervisor")}
          canManage={canManage}
          isOwner={editTask.assignedUserId === user.id}
          onClose={() => setEditTask(null)}
          onDone={() => {
            setEditTask(null);
            qc.invalidateQueries({ queryKey: ["tasks"] });
          }}
        />
      )}
    </>
  );
}

function SuggestTaskDialog({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<DbPriority>("medium");
  const [photo, setPhoto] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
  });

  const submit = useMutation({
    mutationFn: () =>
      createTaskSuggestion({
        projectId,
        title: title.trim(),
        description: description.trim() || null,
        urgency,
        photo,
      }),
    onSuccess: () => {
      toast.success("Sent to admins for approval");
      qc.invalidateQueries({ queryKey: ["task-suggestions"] });
      setProjectId("");
      setTitle("");
      setDescription("");
      setUrgency("medium");
      setPhoto(null);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not send suggestion"),
  });

  const valid = !!projectId && title.trim().length > 0;

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add new task</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        An admin reviews this on the Task Approvals page before it becomes a real task.
      </p>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="st-title">Title</Label>
          <Input id="st-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="st-desc">Description</Label>
          <Textarea
            id="st-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs doing, and why?"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Urgency</Label>
          <Select value={urgency} onValueChange={(v) => setUrgency(v as DbPriority)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        {photo ? (
          <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
            <span className="truncate">{photo.name}</span>
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Camera className="size-4" /> Add photo (optional)
          </Button>
        )}
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={!valid || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? "Sending…" : "Send for approval"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
