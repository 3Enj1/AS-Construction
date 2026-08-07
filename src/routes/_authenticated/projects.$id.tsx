import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
import { TaskCard } from "@/components/tasks/TaskCard";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { LocationPicker } from "@/components/map/LocationPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { codeFromProjectId, enrichTask, type DbTask, type EnrichedTask } from "@/lib/task-mapper";
import { formatDate } from "@/lib/format";
import { imageForId } from "@/lib/stock-images";
import { TASK_CATEGORIES, taskVisual } from "@/lib/task-visuals";
import {
  addProjectExpense,
  deleteProjectExpense,
  fetchMaterialTransactionsForProject,
  fetchProjectExpenses,
  updateProject,
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
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
  notFoundComponent: () => <div className="text-muted-foreground">Project not found.</div>,
});

type StatusValue = "planning" | "active" | "on_hold" | "completed" | "cancelled";
type Phase = { id: string; phase_name: string; sort_order: number; status: string };
type ProjectRow = {
  id: string;
  project_name: string;
  client_name: string | null;
  client_profile_id: string | null;
  site_address: string | null;
  status: string;
  start_date: string | null;
  expected_completion_date: string | null;
  description: string | null;
  assigned_project_manager_id: string | null;
  assigned_site_supervisor_id: string | null;
  budget: number | null;
  latitude: number | null;
  longitude: number | null;
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
            "id,task_title,description,status,priority,category,due_date,project_id,phase_id,assigned_user_id,assigned_supervisor_id,is_archived,submitted_for_review_at,approved_at,completed_at,rejection_reason,client_visible",
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
  const [editProjectOpen, setEditProjectOpen] = useState(false);
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
      <div className="mt-3 as-card overflow-hidden">
        <div className="dark relative h-32 w-full sm:h-40">
          <img
            src={imageForId(project.id)}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
        </div>
        <div className="p-5 sm:p-6">
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
                {canManage && (
                  <span className="inline-flex items-center gap-1">
                    {project.client_profile_id
                      ? "Client account linked"
                      : "No client account linked"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={project.status} kind="tone" />
              {canManage && (
                <Dialog open={editProjectOpen} onOpenChange={setEditProjectOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                  </DialogTrigger>
                  <EditProjectDialog
                    project={project}
                    onDone={() => {
                      setEditProjectOpen(false);
                      invalidate();
                    }}
                  />
                </Dialog>
              )}
            </div>
          </div>
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

      {canManage && <ProjectBudgetSection projectId={project.id} budget={project.budget} />}

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
  const {
    data: usage = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["material-transactions", projectId],
    queryFn: () => fetchMaterialTransactionsForProject(projectId),
    retry: 1,
  });

  return (
    <div className="mt-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Materials used
      </h2>
      {isLoading ? (
        <div className="mt-3 as-card p-6 text-sm text-muted-foreground">Loading materials…</div>
      ) : isError ? (
        <div className="mt-3 as-card p-6 text-sm text-danger">
          Couldn't load materials: {error instanceof Error ? error.message : "Unknown error"}
        </div>
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

function ProjectBudgetSection({ projectId, budget }: { projectId: string; budget: number | null }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const {
    data: expenses = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["project-expenses", projectId],
    queryFn: () => fetchProjectExpenses(projectId),
    retry: 1,
  });

  const spent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget != null ? budget - spent : null;

  const remove = useMutation({
    mutationFn: deleteProjectExpense,
    onSuccess: () => {
      toast.success("Expense removed");
      qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const money = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Budget
        </h2>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="size-4" /> Log expense
            </Button>
          </DialogTrigger>
          <AddExpenseDialog
            projectId={projectId}
            onDone={() => {
              setAddOpen(false);
              qc.invalidateQueries({ queryKey: ["project-expenses", projectId] });
            }}
          />
        </Dialog>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Budget"
          value={budget != null ? money(budget) : "—"}
          icon={Wallet}
          tone="brand"
        />
        <StatCard label="Spent" value={money(spent)} icon={Wallet} tone="warning" />
        <StatCard
          label="Remaining"
          value={remaining != null ? money(remaining) : "—"}
          icon={Wallet}
          tone={remaining != null && remaining < 0 ? "danger" : "success"}
        />
      </div>

      {isLoading ? (
        <div className="mt-3 as-card p-6 text-sm text-muted-foreground">Loading expenses…</div>
      ) : isError ? (
        <div className="mt-3 as-card p-6 text-sm text-danger">
          Couldn't load expenses: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : expenses.length === 0 ? (
        <div className="mt-3 as-card p-6 text-sm text-muted-foreground">
          No expenses logged for this project yet.
        </div>
      ) : (
        <div className="mt-3 as-card divide-y divide-border">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{e.description}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {e.category ? `${e.category} · ` : ""}
                  {formatDate(e.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{money(e.amount)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(e.id)}
                  aria-label="Remove expense"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddExpenseDialog({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");

  const add = useMutation({
    mutationFn: () =>
      addProjectExpense({
        projectId,
        description: description.trim(),
        amount: Number(amount),
        category: category.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Expense logged");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Log expense</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="exp-desc">Description</Label>
          <Input
            id="exp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="exp-amount">Amount</Label>
            <Input
              id="exp-amount"
              type="number"
              min={0.01}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="exp-category">Category (optional)</Label>
            <Input
              id="exp-category"
              placeholder="e.g. materials, labor"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!description.trim() || !Number(amount) || add.isPending}
          onClick={() => add.mutate()}
          variant="brand"
        >
          {add.isPending ? "Logging…" : "Log expense"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditProjectDialog({ project, onDone }: { project: ProjectRow; onDone: () => void }) {
  const { allUsers } = useAuth();
  const clients = allUsers.filter((u) => u.role === "client");
  const [name, setName] = useState(project.project_name);
  const [clientName, setClientName] = useState(project.client_name ?? "");
  const [clientProfileId, setClientProfileId] = useState(project.client_profile_id ?? "none");
  const [address, setAddress] = useState(project.site_address ?? "");
  const [status, setStatus] = useState(project.status as StatusValue);
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [targetDate, setTargetDate] = useState(project.expected_completion_date ?? "");
  const [budget, setBudget] = useState(project.budget != null ? String(project.budget) : "");
  const [latitude, setLatitude] = useState<number | null>(project.latitude);
  const [longitude, setLongitude] = useState<number | null>(project.longitude);

  const save = useMutation({
    mutationFn: () =>
      updateProject(project.id, {
        project_name: name.trim(),
        client_name: clientName.trim() || null,
        client_profile_id: clientProfileId === "none" ? null : clientProfileId,
        site_address: address.trim() || null,
        status,
        start_date: startDate || null,
        expected_completion_date: targetDate || null,
        budget: budget.trim() ? Number(budget) : null,
        latitude,
        longitude,
      }),
    onSuccess: () => {
      toast.success("Project updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit project</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ep-name">Project name</Label>
          <Input id="ep-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ep-client">Client name</Label>
            <Input
              id="ep-client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Client account</Label>
          <Select
            value={clientProfileId}
            onValueChange={(v) => {
              setClientProfileId(v);
              const picked = clients.find((c) => c.id === v);
              if (picked) setClientName(picked.name);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client account linked</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Link an existing client login so they can see this project and its client-visible tasks.
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ep-addr">Site address</Label>
          <Input id="ep-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Map location (optional)</Label>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ep-start">Start date</Label>
            <Input
              id="ep-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ep-target">Target completion</Label>
            <Input
              id="ep-target"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ep-budget">Budget</Label>
          <Input
            id="ep-budget"
            type="number"
            min={0}
            step="0.01"
            placeholder="e.g. 250000"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!name.trim() || save.isPending}
          onClick={() => save.mutate()}
          variant="brand"
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
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
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState("");
  const [clientVisible, setClientVisible] = useState(true);
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        project_id: projectId,
        phase_id: phase.id,
        task_title: title.trim(),
        description: description || null,
        category,
        priority,
        status: "not_started",
        due_date: dueDate || null,
        client_visible: clientVisible,
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {taskVisual(c).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={clientVisible}
              onCheckedChange={(c) => setClientVisible(c === true)}
            />
            Visible to client
          </label>
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
