import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskCard } from "@/components/tasks/TaskCard";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pill, StatusPill } from "@/components/ui/status-pill";
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
import {
  approveTaskSuggestion,
  createTaskSuggestion,
  deleteTaskSuggestion,
  fetchEnrichedTasks,
  fetchProjectsMini,
  fetchTaskSuggestions,
  getSignedPhotoUrls,
  rejectTaskSuggestion,
  type TaskSuggestion,
} from "@/lib/project-actions";
import type { DbPriority } from "@/lib/task-mapper";
import type { EnrichedTask } from "@/lib/task-mapper";
import type { TaskStatus } from "@/lib/types";
import { Camera, CheckCircle2, ImageIcon, Lightbulb, Trash2, X, XCircle } from "lucide-react";
import { toast } from "sonner";

const FILTERS: { label: string; match: (s: TaskStatus) => boolean }[] = [
  { label: "All", match: () => true },
  { label: "Active", match: (s) => ["In Progress", "Assigned", "Not Started"].includes(s) },
  { label: "Overdue", match: (s) => s === "Overdue" },
  { label: "Awaiting review", match: (s) => s === "Submitted for Review" },
  { label: "Blocked", match: (s) => ["Blocked", "Awaiting Materials"].includes(s) },
  { label: "Done", match: (s) => s === "Approved" },
];

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function TasksPage() {
  const { user, allUsers, hasRole } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [editTask, setEditTask] = useState<EnrichedTask | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [rejectingSuggestion, setRejectingSuggestion] = useState<TaskSuggestion | null>(null);
  const [suggestionReason, setSuggestionReason] = useState("");
  const isWorkerLike = user?.role === "worker" || user?.role === "subcontractor";
  const canManage = hasRole("admin", "project_manager", "site_supervisor");
  const canReview = hasRole("admin", "project_manager");

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks", isWorkerLike ? `assigned:${user?.id}` : "all"],
    queryFn: () => fetchEnrichedTasks(isWorkerLike ? { assignedToProfileId: user!.id } : undefined),
    enabled: !!user,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ["task-suggestions"],
    queryFn: fetchTaskSuggestions,
    enabled: !!user,
  });
  const suggestionPhotoPaths = suggestions.map((s) => s.photoUrl).filter((p): p is string => !!p);
  const { data: suggestionPhotoUrls = new Map<string, string>() } = useQuery({
    queryKey: ["task-suggestion-photo-urls", suggestionPhotoPaths],
    queryFn: () => getSignedPhotoUrls(suggestionPhotoPaths),
    enabled: suggestionPhotoPaths.length > 0,
  });

  const invalidateSuggestions = () => qc.invalidateQueries({ queryKey: ["task-suggestions"] });

  const approveSuggestion = useMutation({
    mutationFn: (s: TaskSuggestion) => approveTaskSuggestion(s),
    onSuccess: () => {
      toast.success("Suggestion approved — task created");
      invalidateSuggestions();
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not approve suggestion"),
  });

  const rejectSuggestion = useMutation({
    mutationFn: ({ s, reason }: { s: TaskSuggestion; reason: string }) =>
      rejectTaskSuggestion(s, reason),
    onSuccess: () => {
      toast.success("Suggestion rejected");
      setRejectingSuggestion(null);
      setSuggestionReason("");
      invalidateSuggestions();
    },
    onError: (e: Error) => toast.error(e.message || "Could not reject suggestion"),
  });

  const removeSuggestion = useMutation({
    mutationFn: (id: string) => deleteTaskSuggestion(id),
    onSuccess: () => {
      toast.success("Suggestion deleted");
      invalidateSuggestions();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete suggestion"),
  });

  if (!user) return null;
  const active = FILTERS.find((f) => f.label === filter) ?? FILTERS[0];
  const list: EnrichedTask[] = tasks.filter((t) => active.match(t.status));

  return (
    <>
      <PageHeader
        title={isWorkerLike ? "My tasks" : "Tasks"}
        subtitle={`${list.length} of ${tasks.length} tasks`}
        actions={
          <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Lightbulb className="size-4" /> Suggest a task
              </Button>
            </DialogTrigger>
            <SuggestTaskDialog onDone={() => setSuggestOpen(false)} />
          </Dialog>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={filter === f.label ? "brand" : "outline"}
            size="sm"
            onClick={() => setFilter(f.label)}
          >
            {f.label}
          </Button>
        ))}
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

      {suggestions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Suggested tasks
          </h2>
          <div className="as-card divide-y divide-border">
            {suggestions.map((s) => {
              const photoSrc = s.photoUrl ? suggestionPhotoUrls.get(s.photoUrl) : undefined;
              const isPending = s.status === "pending";
              return (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {s.photoUrl && (
                      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
                        {photoSrc ? (
                          <img src={photoSrc} alt="" className="size-full object-cover" />
                        ) : (
                          <ImageIcon className="size-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.projectName} · suggested by {s.suggestedByName ?? "someone"}
                      </div>
                      {s.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                          {s.description}
                        </div>
                      )}
                      {!isPending && s.reviewComment && (
                        <div className="mt-0.5 text-xs text-muted-foreground italic">
                          "{s.reviewComment}"
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.urgency === "urgent" && <Pill tone="danger">Urgent</Pill>}
                    <StatusPill status={capitalize(s.status)} kind="tone" />
                    {canReview && isPending && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-danger/40 text-danger hover:bg-danger/10"
                          disabled={rejectSuggestion.isPending}
                          onClick={() => setRejectingSuggestion(s)}
                        >
                          <XCircle className="size-4" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-success text-success-foreground hover:bg-success/90"
                          disabled={approveSuggestion.isPending}
                          onClick={() => approveSuggestion.mutate(s)}
                        >
                          <CheckCircle2 className="size-4" /> Approve
                        </Button>
                      </>
                    )}
                    {canReview && !isPending && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-muted-foreground hover:text-danger"
                        disabled={removeSuggestion.isPending}
                        onClick={() => removeSuggestion.mutate(s.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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

      <Dialog
        open={!!rejectingSuggestion}
        onOpenChange={(o) => {
          if (!o) {
            setRejectingSuggestion(null);
            setSuggestionReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject suggestion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{rejectingSuggestion?.title}</p>
          <Textarea
            rows={4}
            placeholder="Reason (optional)…"
            value={suggestionReason}
            onChange={(e) => setSuggestionReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingSuggestion(null);
                setSuggestionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              disabled={rejectSuggestion.isPending}
              onClick={() =>
                rejectingSuggestion &&
                rejectSuggestion.mutate({ s: rejectingSuggestion, reason: suggestionReason.trim() })
              }
            >
              {rejectSuggestion.isPending ? "Sending…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      toast.success("Suggestion sent for review");
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
        <DialogTitle>Suggest a task</DialogTitle>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        An admin or project manager reviews this before it becomes a real task.
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
          {submit.isPending ? "Sending…" : "Send suggestion"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
