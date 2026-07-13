import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
import { TaskCard } from "@/components/tasks/TaskCard";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  codeFromProjectId,
  enrichTask,
  PRIORITY_UI_TO_DB,
  type DbTask,
  type EnrichedTask,
} from "@/lib/task-mapper";
import { formatDate } from "@/lib/format";
import {
  fetchMaterials,
  fetchMaterialTransactionsForProject,
  logMaterialUsage,
} from "@/lib/project-actions";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Layers,
  MapPin,
  Package,
  Plus,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
  notFoundComponent: () => <div className="text-muted-foreground">Project not found.</div>,
});

type Phase = { id: string; phase_name: string; sort_order: number; status: string };
type ProjectRow = {
  id: string;
  project_name: string;
  client_name: string | null;
  site_address: string | null;
  status: string;
  start_date: string | null;
  expected_completion_date: string | null;
  description: string | null;
  assigned_project_manager_id: string | null;
  assigned_site_supervisor_id: string | null;
};

function ProjectDetail() {
  const { id } = Route.useParams();
  const { user, hasRole, allUsers } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "project_manager", "site_supervisor");

  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const [{ data: p }, { data: ph }, { data: tk }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("project_phases")
          .select("id,phase_name,sort_order,status")
          .eq("project_id", id)
          .eq("is_archived", false)
          .order("sort_order"),
        supabase
          .from("tasks")
          .select(
            "id,task_title,description,status,priority,due_date,project_id,phase_id,assigned_user_id,assigned_supervisor_id,is_archived,submitted_for_review_at,approved_at,completed_at,rejection_reason",
          )
          .eq("project_id", id)
          .eq("is_archived", false)
          .order("due_date", { ascending: true, nullsFirst: false }),
      ]);
      if (!p) throw notFound();
      const profileIds = Array.from(
        new Set(
          ((tk ?? []) as DbTask[])
            .flatMap((t) => [t.assigned_user_id, t.assigned_supervisor_id])
            .filter(Boolean) as string[],
        ),
      );
      const { data: profs } = profileIds.length
        ? await supabase.from("profiles").select("id,full_name").in("id", profileIds)
        : { data: [] };
      const profMap = new Map(
        (profs ?? []).map((x: { id: string; full_name: string }) => [x.id, x]),
      );
      const phases = (ph ?? []) as Phase[];
      const phaseMap = new Map(phases.map((x) => [x.id, x]));
      const tasks: EnrichedTask[] = ((tk ?? []) as DbTask[]).map((t) =>
        enrichTask(t, {
          project: { id: p.id, project_name: p.project_name },
          phase: t.phase_id
            ? phaseMap.get(t.phase_id)
              ? { id: t.phase_id, phase_name: phaseMap.get(t.phase_id)!.phase_name }
              : null
            : null,
          assignedUser: t.assigned_user_id ? (profMap.get(t.assigned_user_id) ?? null) : null,
          supervisor: t.assigned_supervisor_id
            ? (profMap.get(t.assigned_supervisor_id) ?? null)
            : null,
        }),
      );
      return { project: p as ProjectRow, phases, tasks };
    },
  });

  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [editTask, setEditTask] = useState<EnrichedTask | null>(null);
  const [addTaskPhase, setAddTaskPhase] = useState<Phase | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project", id] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  if (isLoading)
    return <div className="as-card p-6 text-sm text-muted-foreground">Loading project…</div>;
  if (error || !data)
    return <div className="as-card p-6 text-sm text-danger">Error loading project.</div>;
  const { project, phases, tasks } = data;
  const code = codeFromProjectId(project.id);
  const totalTasks = tasks.length;
  const approved = tasks.filter((t) => t.dbStatus === "approved").length;
  const overallProgress = totalTasks ? Math.round((approved / totalTasks) * 100) : 0;

  return (
    <>
      <Link
        to="/projects"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> All projects
      </Link>
      <div className="mt-3 as-card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-xs text-muted-foreground">{code}</div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              {project.project_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {project.site_address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {project.site_address}
                </span>
              )}
              {project.expected_completion_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3.5" /> Target{" "}
                  {formatDate(project.expected_completion_date)}
                </span>
              )}
            </div>
          </div>
          <StatusPill status={project.status} kind="tone" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Progress" value={`${overallProgress}%`} icon={TrendingUp} tone="brand" />
        <StatCard label="Phases" value={phases.length} icon={Layers} tone="neutral" />
        <StatCard
          label="Tasks"
          value={totalTasks}
          hint={`${tasks.filter((t) => t.status === "Overdue").length} overdue`}
          icon={ClipboardList}
          tone="info"
        />
        <StatCard label="Approved" value={approved} icon={CheckCircle2} tone="success" />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Phases & tasks
        </h2>
        {canManage && (
          <Dialog open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="size-4" /> Add phase
              </Button>
            </DialogTrigger>
            <AddPhaseDialog
              projectId={project.id}
              nextOrder={phases.length}
              onDone={() => {
                setAddPhaseOpen(false);
                invalidate();
              }}
            />
          </Dialog>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="mt-4 as-card p-6 text-sm text-muted-foreground">No phases yet.</div>
      ) : (
        <div className="mt-4 space-y-6">
          {phases.map((ph) => {
            const phTasks = tasks.filter((t) => t.phaseId === ph.id);
            const phApproved = phTasks.filter((t) => t.dbStatus === "approved").length;
            const phPct = phTasks.length ? Math.round((phApproved / phTasks.length) * 100) : 0;
            return (
              <div key={ph.id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">
                      {ph.sort_order + 1}. {ph.phase_name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand shadow-glow-brand transition-all"
                          style={{ width: `${phPct}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {phApproved}/{phTasks.length} approved · {phPct}%
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => setAddTaskPhase(ph)}>
                      <Plus className="size-4" /> Add task
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {phTasks.map((t) => (
                    <TaskCard key={t.id} task={t} onClick={() => setEditTask(t)} />
                  ))}
                  {phTasks.length === 0 && (
                    <div className="as-card p-4 text-sm text-muted-foreground">
                      No tasks in this phase yet.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProjectMaterialsSection projectId={project.id} />

      {addTaskPhase && (
        <AddTaskDialog
          projectId={project.id}
          phase={addTaskPhase}
          onClose={() => setAddTaskPhase(null)}
          onDone={() => {
            setAddTaskPhase(null);
            invalidate();
          }}
        />
      )}
      {editTask && (
        <EditTaskDialog
          task={editTask}
          assignableUsers={allUsers.filter((u) => ["worker", "subcontractor"].includes(u.role))}
          supervisors={allUsers.filter((u) => u.role === "site_supervisor")}
          canManage={canManage}
          isOwner={editTask.assignedUserId === user?.id}
          onClose={() => setEditTask(null)}
          onDone={() => {
            setEditTask(null);
            invalidate();
          }}
        />
      )}
    </>
  );
}

function ProjectMaterialsSection({ projectId }: { projectId: string }) {
  const { data: usage = [], isLoading } = useQuery({
    queryKey: ["material-transactions", projectId],
    queryFn: () => fetchMaterialTransactionsForProject(projectId),
  });

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Materials used
      </h2>
      {isLoading ? (
        <div className="mt-3 as-card p-6 text-sm text-muted-foreground">Loading materials…</div>
      ) : usage.length === 0 ? (
        <div className="mt-3 as-card p-6 text-sm text-muted-foreground">
          No material transactions logged for this project yet.
        </div>
      ) : (
        <div className="mt-3 as-card divide-y divide-border">
          {usage.map((u) => (
            <div key={u.materialId} className="flex items-center justify-between gap-3 p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid size-8 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Package className="size-4" />
                </div>
                <span className="text-sm font-medium">{u.materialName}</span>
              </div>
              <span
                className={
                  "text-sm font-semibold tabular-nums " +
                  (u.totalQty < 0 ? "text-danger" : "text-success")
                }
              >
                {u.totalQty > 0 ? "+" : ""}
                {u.totalQty.toLocaleString()} {u.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPhaseDialog({
  projectId,
  nextOrder,
  onDone,
}: {
  projectId: string;
  nextOrder: number;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_phases").insert({
        project_id: projectId,
        phase_name: name.trim(),
        sort_order: nextOrder,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Phase added");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add phase</DialogTitle>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="ph-name">Phase name</Label>
        <Input id="ph-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <DialogFooter>
        <Button disabled={!name.trim() || m.isPending} onClick={() => m.mutate()} variant="brand">
          {m.isPending ? "Adding…" : "Add phase"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddTaskDialog({
  projectId,
  phase,
  onClose,
  onDone,
}: {
  projectId: string;
  phase: Phase;
  onClose: () => void;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        phase_id: phase.id,
        task_title: title.trim(),
        description: description || null,
        priority,
        status: "not_started",
        due_date: dueDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task added");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task in {phase.phase_name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
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
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!title.trim() || m.isPending}
            onClick={() => m.mutate()}
            variant="brand"
          >
            {m.isPending ? "Adding…" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTaskDialog({
  task,
  assignableUsers,
  supervisors,
  canManage,
  isOwner,
  onClose,
  onDone,
}: {
  task: EnrichedTask;
  assignableUsers: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  canManage: boolean;
  isOwner: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  // (no router navigation needed inside dialog)
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(PRIORITY_UI_TO_DB[task.priority]);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [status, setStatus] = useState(task.dbStatus);
  const [assignedUserId, setAssignedUserId] = useState(task.assignedUserId ?? "unassigned");
  const [supervisorId, setSupervisorId] = useState(task.supervisorId ?? "unassigned");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const prevAssignee = task.assignedUserId;
      const updates: TablesUpdate<"tasks"> = {};
      if (canManage) {
        updates.task_title = title.trim();
        updates.description = description || null;
        updates.priority = priority;
        updates.due_date = dueDate || null;
        updates.assigned_user_id = assignedUserId === "unassigned" ? null : assignedUserId;
        updates.assigned_supervisor_id = supervisorId === "unassigned" ? null : supervisorId;
      }
      updates.status = status;
      const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
      if (error) throw error;

      if (canManage && updates.assigned_user_id && updates.assigned_user_id !== prevAssignee) {
        await supabase.from("notifications").insert({
          for_user_id: updates.assigned_user_id as string,
          kind: "info",
          title: "New task assigned",
          body: `You have been assigned: ${title}`,
          link_url: `/tasks`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Task updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: me } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", u.user!.id)
        .maybeSingle();
      const { error } = await supabase.from("task_updates").insert({
        task_id: task.id,
        project_id: task.projectId,
        user_id: me!.id,
        update_type: "note",
        note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Update added");
      setNote("");
      qcInvalidate(task.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: me } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", u.user!.id)
        .maybeSingle();
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "submitted_for_review",
          submitted_for_review_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw error;
      await supabase.from("task_updates").insert({
        task_id: task.id,
        project_id: task.projectId,
        user_id: me!.id,
        update_type: "submitted_for_review",
        note: note || null,
      });
      // best-effort notifications
      const { data: proj } = await supabase
        .from("projects")
        .select("assigned_project_manager_id,assigned_site_supervisor_id")
        .eq("id", task.projectId)
        .maybeSingle();
      const recipients = [
        proj?.assigned_project_manager_id,
        proj?.assigned_site_supervisor_id,
        task.supervisorId,
      ].filter(Boolean) as string[];
      if (recipients.length) {
        await supabase.from("notifications").insert(
          recipients.map((rid) => ({
            for_user_id: rid,
            kind: "info",
            title: "Task submitted for review",
            body: `${task.title}`,
            link_url: "/approvals",
          })),
        );
      } else {
        await supabase.from("notifications").insert({
          for_role: "admin",
          kind: "info",
          title: "Task submitted for review",
          body: `${task.title}`,
          link_url: "/approvals",
        });
      }
    },
    onSuccess: () => {
      toast.success("Submitted for review");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const qcInvalidate = (taskId: string) => {
    // hook into outer query client by triggering done -> caller invalidates
    void taskId;
  };

  const [usageMaterialId, setUsageMaterialId] = useState("");
  const [usageQty, setUsageQty] = useState("");
  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: fetchMaterials,
  });
  const logUsage = useMutation({
    mutationFn: () =>
      logMaterialUsage({
        materialId: usageMaterialId,
        projectId: task.projectId,
        taskId: task.id,
        quantity: Number(usageQty),
      }),
    onSuccess: () => {
      toast.success("Usage logged");
      setUsageMaterialId("");
      setUsageQty("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const canLogUsage =
    (canManage || isOwner) &&
    ["assigned", "in_progress", "awaiting_materials"].includes(task.dbStatus);

  const { data: updates = [] } = useQuery({
    queryKey: ["task-updates", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_updates")
        .select("id,update_type,note,created_at,user_id")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{canManage ? "Edit task" : "Task"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as typeof status)}
                disabled={!canManage && !isOwner}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="awaiting_materials">Awaiting materials</SelectItem>
                  {canManage && <SelectItem value="approved">Approved</SelectItem>}
                  {canManage && <SelectItem value="rejected">Rejected</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as typeof priority)}
                disabled={!canManage}
              >
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
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>
          {canManage && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Assigned to</Label>
                <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Supervisor</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {supervisors.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(canManage || isOwner) && (
            <div className="grid gap-1.5 border-t border-border pt-3">
              <Label>Add progress note</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's the latest?"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!note.trim() || addNote.isPending}
                  onClick={() => addNote.mutate()}
                >
                  Add note
                </Button>
                {isOwner &&
                  task.dbStatus !== "submitted_for_review" &&
                  task.dbStatus !== "approved" && (
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={submitReview.isPending}
                      onClick={() => submitReview.mutate()}
                    >
                      Submit for review
                    </Button>
                  )}
              </div>
            </div>
          )}

          {canLogUsage && (
            <div className="grid gap-1.5 border-t border-border pt-3">
              <Label>Log material usage</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Select value={usageMaterialId} onValueChange={setUsageMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Qty"
                  value={usageQty}
                  onChange={(e) => setUsageQty(e.target.value)}
                  className="sm:w-24"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!usageMaterialId || !Number(usageQty) || logUsage.isPending}
                  onClick={() => logUsage.mutate()}
                >
                  {logUsage.isPending ? "Logging…" : "Log"}
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              History
            </div>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {updates.length === 0 && (
                <div className="text-xs text-muted-foreground">No updates yet.</div>
              )}
              {updates.map((u) => (
                <div key={u.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="font-medium">{u.update_type}</div>
                  {u.note && <div className="mt-0.5 text-muted-foreground">{u.note}</div>}
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(u.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {canManage && (
            <Button
              variant="outline"
              className="border-danger/40 text-danger hover:bg-danger/10"
              onClick={async () => {
                const { error } = await supabase
                  .from("tasks")
                  .update({
                    is_archived: true,
                    archived_at: new Date().toISOString(),
                  })
                  .eq("id", task.id);
                if (error) toast.error(error.message);
                else {
                  toast.success("Task archived");
                  onDone();
                }
              }}
            >
              Archive
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending} variant="brand">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
