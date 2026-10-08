import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { RemoveTaskDialog, RemovedTasksDialog } from "@/components/tasks/RemoveTaskDialog";
import {
  DailyDiaryDialog,
  ProjectDiary,
  isDiaryReminderSnoozed,
  useDiaryMissingToday,
} from "@/components/tasks/TaskDiary";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectChatPanel } from "@/components/chat/ProjectChatPanel";
import { RaiseRequestDialog } from "@/components/materials/RaiseRequestDialog";
import { Pill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabCarousel, type TabCarouselItem } from "@/components/ui/tab-carousel";
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
import { formatDate, relativeFromNow } from "@/lib/format";
import { imageForId } from "@/lib/stock-images";
import { TASK_CATEGORIES, taskVisual } from "@/lib/task-visuals";
import { cn } from "@/lib/utils";
import {
  addProjectExpense,
  approveTask,
  deleteProjectExpense,
  fetchMaterialRequests,
  fetchMaterialTransactionsForProject,
  fetchProjectExpenses,
  rejectTask,
  reviewMaterialRequest,
  updateProject,
} from "@/lib/project-actions";
import type { MaterialRequest } from "@/lib/types";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  LayoutGrid,
  Layers,
  ListPlus,
  MapPin,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";

const PROJECT_TABS = ["overview", "chat", "diary", "approvals", "materials", "budget"] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];
type ProjectSearch = { tab?: ProjectTab };

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
  validateSearch: (search: Record<string, unknown>): ProjectSearch => ({
    tab: PROJECT_TABS.includes(search.tab as ProjectTab) ? (search.tab as ProjectTab) : undefined,
  }),
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
};

function ProjectDetail() {
  const { id } = Route.useParams();
  const { tab: tabFromSearch } = Route.useSearch();
  const navigate = useNavigate();
  const { user, hasRole, allUsers } = useAuth();
  const qc = useQueryClient();
  const canManage = hasRole("admin", "project_manager", "site_supervisor");
  const isClient = hasRole("client");

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
  const [removeTask, setRemoveTask] = useState<EnrichedTask | null>(null);
  const [removedListOpen, setRemovedListOpen] = useState(false);
  // null = closed; otherwise the phase to preselect ("" = no phase).
  const [addTaskPhaseId, setAddTaskPhaseId] = useState<string | null>(null);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [diaryIsReminder, setDiaryIsReminder] = useState(false);

  // Daily diary reminder: on an active project, pop the diary up once per
  // visit if nobody has sent today's entry yet (unless snoozed for today).
  const diaryMissing = useDiaryMissingToday(id, !isClient && data?.project.status === "active");
  const reminderShownRef = useRef(false);
  useEffect(() => {
    if (!diaryMissing || reminderShownRef.current || isDiaryReminderSnoozed(id)) return;
    reminderShownRef.current = true;
    setDiaryIsReminder(true);
    setDiaryOpen(true);
  }, [diaryMissing, id]);

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
  const pendingApproval = tasks.filter((t) => t.dbStatus === "submitted_for_review");
  // Fall back to Overview if the URL names a tab this role can't see.
  const allowedTabs: ProjectTab[] = [
    "overview",
    "chat",
    ...(!isClient ? (["diary", "materials"] as const) : []),
    ...(canManage ? (["approvals", "budget"] as const) : []),
  ];
  const tab: ProjectTab =
    tabFromSearch && allowedTabs.includes(tabFromSearch) ? tabFromSearch : "overview";
  const tabItems: (TabCarouselItem & { value: ProjectTab })[] = [
    { value: "overview" as const, label: "Overview", icon: LayoutGrid },
    { value: "chat" as const, label: "Chat", icon: MessageSquare },
    { value: "diary" as const, label: "Diary", icon: BookOpen },
    {
      value: "approvals" as const,
      label: "Approvals",
      icon: CheckSquare,
      badge: pendingApproval.length,
    },
    { value: "materials" as const, label: "Materials", icon: Package },
    { value: "budget" as const, label: "Budget", icon: Wallet },
  ].filter((t) => allowedTabs.includes(t.value));
  const changeTab = (v: string) =>
    navigate({
      to: "/projects/$id",
      params: { id },
      search: { tab: v === "overview" ? undefined : (v as ProjectTab) },
      replace: true,
      // Switching tabs isn't a new page: don't jump to the top. The router's
      // scroll reset also cancelled the tab carousel's slide mid-animation.
      resetScroll: false,
    });

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
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={project.status} kind="tone" />
              {!isClient && (
                <Button
                  size="sm"
                  variant="brand"
                  onClick={() => {
                    setDiaryIsReminder(false);
                    setDiaryOpen(true);
                  }}
                >
                  <BookOpen className="size-3.5" /> Daily diary
                  {diaryMissing && (
                    <span
                      className="size-2 rounded-full bg-warning"
                      aria-label="Today's diary not sent yet"
                    />
                  )}
                </Button>
              )}
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
                      qc.invalidateQueries({ queryKey: ["projects"] });
                    }}
                  />
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab} className="mt-4">
        {/* Phones: swipeable carousel. Larger screens: the normal tab bar. */}
        <TabCarousel items={tabItems} value={tab} onValueChange={changeTab} className="sm:hidden" />
        <TabsList className="hidden h-10 w-max sm:inline-flex">
          {tabItems.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.value} value={t.value} className="group gap-1.5">
                <Icon className="size-4" /> {t.label}
                {!!t.badge && (
                  <span className="rounded-full bg-brand px-1.5 text-[10px] font-semibold text-brand-foreground group-data-[state=active]:bg-brand-foreground group-data-[state=active]:text-brand">
                    {t.badge}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Progress"
              value={`${overallProgress}%`}
              icon={TrendingUp}
              tone="brand"
            />
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

          <PhasesAndTasks
            phases={phases}
            tasks={tasks}
            canManage={canManage}
            onOpenTask={setEditTask}
            onRemoveTask={setRemoveTask}
            onShowRemoved={() => setRemovedListOpen(true)}
            onAddPhase={() => setAddPhaseOpen(true)}
            onAddTask={(phaseId) => setAddTaskPhaseId(phaseId ?? "")}
          />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <ProjectChatPanel projectId={project.id} className="h-[70dvh] sm:h-[600px]" />
        </TabsContent>

        {!isClient && (
          <TabsContent value="diary" className="mt-4">
            <ProjectDiary
              projectId={project.id}
              taskTitles={new Map(tasks.map((t) => [t.id, t.title]))}
            />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="approvals" className="mt-4">
            <ProjectApprovals tasks={pendingApproval} onChanged={invalidate} />
          </TabsContent>
        )}

        {!isClient && (
          <TabsContent value="materials" className="mt-4">
            <ProjectMaterialRequests projectId={project.id} />
            <ProjectMaterialsSection projectId={project.id} />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="budget" className="mt-4">
            <ProjectBudgetSection projectId={project.id} budget={project.budget} />
          </TabsContent>
        )}
      </Tabs>

      {canManage && (
        <Dialog open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
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
      {canManage && (
        <RemovedTasksDialog
          projectId={project.id}
          open={removedListOpen}
          onOpenChange={setRemovedListOpen}
          onRestored={invalidate}
        />
      )}
      <RemoveTaskDialog
        task={removeTask}
        open={!!removeTask}
        onOpenChange={(o) => !o && setRemoveTask(null)}
        onRemoved={invalidate}
      />
      {addTaskPhaseId !== null && (
        <AddTaskDialog
          projectId={project.id}
          phases={phases}
          defaultPhaseId={addTaskPhaseId || null}
          onClose={() => setAddTaskPhaseId(null)}
          onDone={() => {
            setAddTaskPhaseId(null);
            invalidate();
          }}
        />
      )}
      {!isClient && (
        <DailyDiaryDialog
          open={diaryOpen}
          onOpenChange={setDiaryOpen}
          projectId={project.id}
          projectName={project.project_name}
          tasks={tasks.map((t) => ({ id: t.id, title: t.title }))}
          reminder={diaryIsReminder}
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

/** Phases as collapsed rows (tap to open), tasks as slim lines, and a single
 * "Add" menu — phases are optional, so tasks without one get their own group. */
function PhasesAndTasks({
  phases,
  tasks,
  canManage,
  onOpenTask,
  onRemoveTask,
  onShowRemoved,
  onAddPhase,
  onAddTask,
}: {
  phases: Phase[];
  tasks: EnrichedTask[];
  canManage: boolean;
  onOpenTask: (t: EnrichedTask) => void;
  onRemoveTask: (t: EnrichedTask) => void;
  onShowRemoved: () => void;
  onAddPhase: () => void;
  onAddTask: (phaseId: string | null) => void;
}) {
  const phaseIds = new Set(phases.map((p) => p.id));
  const unphased = tasks.filter((t) => !t.phaseId || !phaseIds.has(t.phaseId));
  const groups = [
    ...phases.map((ph, i) => ({
      key: ph.id,
      phaseId: ph.id as string | null,
      label: `${i + 1}. ${ph.phase_name}`,
      tasks: tasks.filter((t) => t.phaseId === ph.id),
    })),
    ...(unphased.length > 0
      ? [{ key: "no-phase", phaseId: null, label: "No phase", tasks: unphased }]
      : []),
  ];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Phases & tasks
        </h2>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="size-4" /> Add <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onAddTask(null)}>
                <ClipboardList className="size-4" /> New task
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddPhase}>
                <Layers className="size-4" /> New phase
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="mt-3 as-card p-4 text-sm text-muted-foreground">
          No phases or tasks yet{canManage ? " — use Add to create one." : "."}
        </div>
      ) : (
        <Accordion type="multiple" className="mt-3 as-card divide-y divide-border px-3 sm:px-4">
          {groups.map((g) => {
            const done = g.tasks.filter((t) => t.dbStatus === "approved").length;
            const pct = g.tasks.length ? Math.round((done / g.tasks.length) * 100) : 0;
            return (
              <AccordionItem key={g.key} value={g.key} className="border-b-0">
                <AccordionTrigger className="gap-3 py-3 hover:no-underline">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{g.label}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 w-full max-w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[11px] font-normal text-muted-foreground">
                        {done}/{g.tasks.length} done
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {g.tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onClick={() => onOpenTask(t)}
                        onRemove={canManage ? () => onRemoveTask(t) : undefined}
                      />
                    ))}
                    {g.tasks.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No tasks yet.</div>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-8 text-xs text-muted-foreground"
                      onClick={() => onAddTask(g.phaseId)}
                    >
                      <ListPlus className="size-3.5" /> Add task here
                    </Button>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
      {canManage && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-8 text-xs text-muted-foreground"
          onClick={onShowRemoved}
        >
          <RotateCcw className="size-3.5" /> Removed tasks
        </Button>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onClick,
  onRemove,
}: {
  task: EnrichedTask;
  onClick: () => void;
  onRemove?: () => void;
}) {
  const visual = taskVisual(task.category);
  const CategoryIcon = visual.icon;
  const assignee = task.assignees[0];
  return (
    <div className={cn("flex items-center", task.status === "Overdue" && "bg-danger/5")}>
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left hover:bg-accent as-press"
      >
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", visual.tone)}>
          <CategoryIcon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{task.title}</div>
          {(task.dueDate || assignee) && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {task.dueDate && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3" /> {formatDate(task.dueDate)}
                </span>
              )}
              {assignee && <span className="truncate">{assignee.name.split(" ")[0]}</span>}
            </div>
          )}
        </div>
        <StatusPill status={task.status} kind="task" className="shrink-0" />
      </button>
      {onRemove && (
        <Button
          size="icon"
          variant="ghost"
          className="mr-1 size-8 shrink-0 text-muted-foreground hover:text-danger"
          onClick={onRemove}
          aria-label={`Remove ${task.title}`}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}

function ProjectApprovals({ tasks, onChanged }: { tasks: EnrichedTask[]; onChanged: () => void }) {
  const [rejecting, setRejecting] = useState<EnrichedTask | null>(null);
  const [reason, setReason] = useState("");

  const approve = useMutation({
    mutationFn: (t: EnrichedTask) => approveTask(t),
    onSuccess: () => {
      toast.success("Task approved");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: ({ t, reason }: { t: EnrichedTask; reason: string }) => rejectTask(t, reason),
    onSuccess: () => {
      toast.success("Task sent back for rework");
      setRejecting(null);
      setReason("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (tasks.length === 0)
    return (
      <div className="as-card p-6 text-sm text-muted-foreground">
        Nothing in this project is waiting for approval.
      </div>
    );

  return (
    <>
      <div className="as-card divide-y divide-border">
        {tasks.map((t) => {
          const submitter = t.assignees[0];
          return (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {submitter && <UserAvatar user={submitter} size={20} />}
                  {submitter ? (
                    <>
                      Submitted by <span className="text-foreground">{submitter.name}</span>
                    </>
                  ) : (
                    "Submitted for review"
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-danger/40 text-danger hover:bg-danger/10"
                  onClick={() => setRejecting(t)}
                  disabled={reject.isPending}
                >
                  <XCircle className="size-4" /> Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => approve.mutate(t)}
                  disabled={approve.isPending}
                >
                  <CheckCircle2 className="size-4" /> Approve
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog
        open={!!rejecting}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{rejecting?.title}</p>
          <Textarea
            rows={4}
            placeholder="Reason for rejection (required)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => rejecting && reject.mutate({ t: rejecting, reason: reason.trim() })}
            >
              {reject.isPending ? "Sending…" : "Send for rework"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectMaterialRequests({ projectId }: { projectId: string }) {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const {
    data: requests = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["material-requests", projectId],
    queryFn: () => fetchMaterialRequests(projectId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["material-requests"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
    qc.invalidateQueries({ queryKey: ["material-transactions", projectId] });
  };

  const review = useMutation({
    mutationFn: (input: { request: MaterialRequest; decision: "approved" | "denied" }) =>
      reviewMaterialRequest(input.request, input.decision),
    onSuccess: (_data, vars) => {
      toast.success(vars.decision === "approved" ? "Request approved" : "Request denied");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not update request"),
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Material requests
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="size-4" /> Raise request
            </Button>
          </DialogTrigger>
          <RaiseRequestDialog
            projectId={projectId}
            onCreated={() => {
              setOpen(false);
              invalidate();
            }}
          />
        </Dialog>
      </div>
      {isLoading ? (
        <div className="mt-3 as-card p-6 text-sm text-muted-foreground">Loading requests…</div>
      ) : isError ? (
        <div className="mt-3 as-card p-6 text-sm text-danger">
          Couldn't load requests: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : requests.length === 0 ? (
        <div className="mt-3 as-card p-6 text-sm text-muted-foreground">
          No material requests for this project yet.
        </div>
      ) : (
        <div className="mt-3 as-card divide-y divide-border">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {r.material}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {r.quantity} {r.unit}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Raised {relativeFromNow(r.createdAt)} by {r.requestedByName ?? "someone"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.urgency === "Urgent" && <Pill tone="danger">Urgent</Pill>}
                <StatusPill status={r.status} kind="tone" />
                {hasRole("admin") && r.status === "Pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-danger/40 text-danger hover:bg-danger/10"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ request: r, decision: "denied" })}
                    >
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      className="bg-success text-success-foreground hover:bg-success/90"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ request: r, decision: "approved" })}
                    >
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
  phases,
  defaultPhaseId,
  onClose,
  onDone,
}: {
  projectId: string;
  phases: Phase[];
  defaultPhaseId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phaseId, setPhaseId] = useState(defaultPhaseId ?? "none");
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
        phase_id: phaseId === "none" ? null : phaseId,
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
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Phase (optional)</Label>
            <Select value={phaseId} onValueChange={setPhaseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No phase</SelectItem>
                {phases.map((ph) => (
                  <SelectItem key={ph.id} value={ph.id}>
                    {ph.phase_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
