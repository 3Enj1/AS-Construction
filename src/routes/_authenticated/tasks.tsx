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
import { Camera, Plus, X } from "lucide-react";
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

function TasksPage() {
  const { user, allUsers, hasRole } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [editTask, setEditTask] = useState<EnrichedTask | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const isWorkerLike = user?.role === "worker" || user?.role === "subcontractor";
  const canManage = hasRole("admin", "project_manager", "site_supervisor");

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks", isWorkerLike ? `assigned:${user?.id}` : "all"],
    queryFn: () => fetchEnrichedTasks(isWorkerLike ? { assignedToProfileId: user!.id } : undefined),
    enabled: !!user,
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
              <Button variant="brand">
                <Plus className="size-4" /> Add new task
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
