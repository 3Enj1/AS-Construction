import { supabase } from "@/integrations/supabase/client";
import type { DbPriority, DbTask } from "./task-mapper";
import { enrichTask, type EnrichedTask } from "./task-mapper";
import type {
  Material,
  MaterialRequest,
  AttendanceLog,
  ChatMessage,
  ChatReaction,
  Role,
  Project,
  Notification,
} from "./types";

export type ProjectMini = { id: string; project_name: string };
export type PhaseMini = { id: string; phase_name: string; project_id: string };
export type ProfileMini = { id: string; full_name: string };

/** Fetch all tasks the current user can read, fully enriched. */
export async function fetchEnrichedTasks(opts?: {
  assignedToProfileId?: string;
}): Promise<EnrichedTask[]> {
  let q = supabase
    .from("tasks")
    .select(
      "id,task_title,description,status,priority,category,due_date,project_id,phase_id,assigned_user_id,assigned_supervisor_id,is_archived,submitted_for_review_at,approved_at,completed_at,rejection_reason,client_visible",
    )
    .eq("is_archived", false)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (opts?.assignedToProfileId) q = q.eq("assigned_user_id", opts.assignedToProfileId);
  const { data: tasks, error } = await q;
  if (error) throw error;
  const rows = (tasks as DbTask[]) ?? [];
  if (rows.length === 0) return [];

  const projectIds = Array.from(new Set(rows.map((t) => t.project_id)));
  const phaseIds = Array.from(new Set(rows.map((t) => t.phase_id).filter(Boolean) as string[]));
  const profileIds = Array.from(
    new Set(
      rows
        .flatMap((t) => [t.assigned_user_id, t.assigned_supervisor_id])
        .filter(Boolean) as string[],
    ),
  );

  const [projectsRes, phasesRes, profilesRes] = await Promise.all([
    projectIds.length
      ? supabase.from("projects").select("id,project_name").in("id", projectIds)
      : Promise.resolve({ data: [] as ProjectMini[], error: null }),
    phaseIds.length
      ? supabase.from("project_phases").select("id,phase_name,project_id").in("id", phaseIds)
      : Promise.resolve({ data: [] as PhaseMini[], error: null }),
    profileIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as ProfileMini[], error: null }),
  ]);

  const projectMap = new Map(((projectsRes.data as ProjectMini[]) ?? []).map((p) => [p.id, p]));
  const phaseMap = new Map(((phasesRes.data as PhaseMini[]) ?? []).map((p) => [p.id, p]));
  const profileMap = new Map(((profilesRes.data as ProfileMini[]) ?? []).map((p) => [p.id, p]));

  return rows.map((t) =>
    enrichTask(t, {
      project: projectMap.get(t.project_id) ?? null,
      phase: t.phase_id ? (phaseMap.get(t.phase_id) ?? null) : null,
      assignedUser: t.assigned_user_id ? (profileMap.get(t.assigned_user_id) ?? null) : null,
      supervisor: t.assigned_supervisor_id
        ? (profileMap.get(t.assigned_supervisor_id) ?? null)
        : null,
    }),
  );
}

/** Create a project, optionally generating phases + tasks from a template. */
export async function createProjectFromTemplate(input: {
  project_name: string;
  client_name?: string | null;
  client_profile_id?: string | null;
  site_address?: string | null;
  description?: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  start_date?: string | null;
  expected_completion_date?: string | null;
  budget?: number | null;
  template_id?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", u.user!.id)
    .maybeSingle();

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .insert({
      project_name: input.project_name,
      client_name: input.client_name ?? null,
      client_profile_id: input.client_profile_id ?? null,
      site_address: input.site_address ?? null,
      description: input.description ?? null,
      status: input.status,
      start_date: input.start_date ?? null,
      expected_completion_date: input.expected_completion_date ?? null,
      budget: input.budget ?? null,
      created_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;

  if (!input.template_id) return { projectId: project.id, phases: 0, tasks: 0 };

  const { data: tts, error: ttErr } = await supabase
    .from("task_templates")
    .select(
      "phase_name,phase_description,task_title,task_description,default_priority,sort_order,estimated_duration_days",
    )
    .eq("project_template_id", input.template_id)
    .order("sort_order", { ascending: true });
  if (ttErr) throw ttErr;

  // group by phase preserving order of first appearance
  const phaseOrder: string[] = [];
  const phaseDesc = new Map<string, string | null>();
  for (const t of tts ?? []) {
    if (!phaseDesc.has(t.phase_name)) {
      phaseOrder.push(t.phase_name);
      phaseDesc.set(t.phase_name, t.phase_description ?? null);
    }
  }

  const phaseRows = phaseOrder.map((name, idx) => ({
    project_id: project.id,
    phase_name: name,
    description: phaseDesc.get(name) ?? null,
    sort_order: idx,
    status: "pending",
  }));
  const { data: phases, error: phErr } = await supabase
    .from("project_phases")
    .insert(phaseRows)
    .select("id,phase_name");
  if (phErr) throw phErr;
  const phaseByName = new Map((phases ?? []).map((p) => [p.phase_name, p.id]));

  const startMs = input.start_date ? new Date(input.start_date).getTime() : null;
  const taskRows = (tts ?? []).map((t, idx) => {
    const days = t.estimated_duration_days ?? 7;
    const due = startMs
      ? new Date(startMs + idx * Math.max(days, 1) * 86_400_000).toISOString().slice(0, 10)
      : null;
    return {
      project_id: project.id,
      phase_id: phaseByName.get(t.phase_name) ?? null,
      task_title: t.task_title,
      description: t.task_description ?? null,
      priority: t.default_priority,
      status: "not_started" as const,
      due_date: due,
      client_visible: true,
    };
  });
  if (taskRows.length) {
    const { error: tkErr } = await supabase.from("tasks").insert(taskRows);
    if (tkErr) throw tkErr;
  }

  return { projectId: project.id, phases: phaseRows.length, tasks: taskRows.length };
}

/** Edit a project's core details, including (re)linking it to a client account. */
export async function updateProject(
  id: string,
  input: {
    project_name: string;
    client_name?: string | null;
    client_profile_id?: string | null;
    site_address?: string | null;
    status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
    start_date?: string | null;
    expected_completion_date?: string | null;
    budget?: number | null;
  },
) {
  const { error } = await supabase
    .from("projects")
    .update({
      project_name: input.project_name,
      client_name: input.client_name ?? null,
      client_profile_id: input.client_profile_id ?? null,
      site_address: input.site_address ?? null,
      status: input.status,
      start_date: input.start_date ?? null,
      expected_completion_date: input.expected_completion_date ?? null,
      budget: input.budget ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Overwrite each project's `progress` with the real approved/total task ratio. */
export async function attachProjectProgress(projects: Project[]): Promise<Project[]> {
  if (projects.length === 0) return projects;
  const ids = projects.map((p) => p.id);
  const { data, error } = await supabase
    .from("tasks")
    .select("project_id,status")
    .in("project_id", ids)
    .eq("is_archived", false);
  if (error) throw error;

  const counts = new Map<string, { total: number; approved: number }>();
  for (const t of data ?? []) {
    const c = counts.get(t.project_id) ?? { total: 0, approved: 0 };
    c.total++;
    if (t.status === "approved") c.approved++;
    counts.set(t.project_id, c);
  }

  return projects.map((p) => {
    const c = counts.get(p.id);
    return c && c.total > 0 ? { ...p, progress: Math.round((c.approved / c.total) * 100) } : p;
  });
}

/** Returns the current user's profile id (cached short-term). */
let _meIdCache: { authId: string; profileId: string } | null = null;
export async function currentProfileId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  if (_meIdCache?.authId === data.user.id) return _meIdCache.profileId;
  const { data: p } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (p) _meIdCache = { authId: data.user.id, profileId: p.id };
  return p?.id ?? null;
}

/** Tasks approved per day over the last 30 days, for the dashboard trend chart. */
export async function fetchTaskCompletionTrend(): Promise<{ date: string; count: number }[]> {
  const since = new Date(Date.now() - 29 * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("tasks")
    .select("approved_at")
    .eq("status", "approved")
    .gte("approved_at", since.toISOString());
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.approved_at) continue;
    const day = row.approved_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const days: { date: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: counts.get(key) ?? 0,
    });
  }
  return days;
}

/** Minimal list of non-archived projects, for pickers. */
export async function fetchProjectsMini(): Promise<ProjectMini[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,project_name")
    .eq("is_archived", false)
    .order("project_name", { ascending: true });
  if (error) throw error;
  return (data as ProjectMini[]) ?? [];
}

async function notify(input: {
  forUserId?: string | null;
  forRole?: Role | null;
  title: string;
  body: string;
  kind?: "info" | "warning" | "success" | "danger";
  linkUrl?: string;
}) {
  await supabase.from("notifications").insert({
    for_user_id: input.forUserId ?? null,
    for_role: input.forRole ?? null,
    title: input.title,
    body: input.body,
    kind: input.kind ?? "info",
    link_url: input.linkUrl ?? null,
  });
}

// ============ MATERIAL TRANSACTIONS (ledger) ============
// materials.stock is derived — only the apply_material_transaction() DB
// trigger writes it. Every stock change must go through this insert.

async function insertMaterialTransaction(input: {
  materialId: string;
  projectId?: string | null;
  taskId?: string | null;
  qtyDelta: number;
  type: "delivery" | "usage" | "adjustment";
  note?: string | null;
}) {
  const meId = await currentProfileId();
  const { error } = await supabase.from("material_transactions").insert({
    material_id: input.materialId,
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    qty_delta: input.qtyDelta,
    type: input.type,
    note: input.note ?? null,
    created_by: meId,
  });
  if (error) {
    if (error.code === "23514") throw new Error("Not enough stock available for this action.");
    throw error;
  }
}

export async function logMaterialUsage(input: {
  materialId: string;
  projectId: string;
  taskId: string;
  quantity: number;
  note?: string | null;
}) {
  if (input.quantity <= 0) throw new Error("Quantity must be greater than zero");
  await insertMaterialTransaction({
    materialId: input.materialId,
    projectId: input.projectId,
    taskId: input.taskId,
    qtyDelta: -Math.abs(input.quantity),
    type: "usage",
    note: input.note,
  });
}

export async function receiveStock(input: {
  materialId: string;
  quantity: number;
  note?: string | null;
}) {
  if (input.quantity <= 0) throw new Error("Quantity must be greater than zero");
  await insertMaterialTransaction({
    materialId: input.materialId,
    qtyDelta: Math.abs(input.quantity),
    type: "delivery",
    note: input.note,
  });
}

// ============ MATERIALS ============

type DbMaterial = {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  threshold: number;
  supplier: string | null;
};

function mapMaterial(m: DbMaterial): Material {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    unit: m.unit,
    stock: Number(m.stock),
    threshold: Number(m.threshold),
    supplier: m.supplier ?? "",
  };
}

export async function fetchMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("id,name,category,unit,stock,threshold,supplier")
    .eq("is_archived", false)
    .order("name", { ascending: true });
  if (error) throw error;
  return ((data as DbMaterial[]) ?? []).map(mapMaterial);
}

export async function addMaterial(input: {
  name: string;
  category: string;
  unit: string;
  stock: number;
  threshold: number;
  supplier?: string | null;
}) {
  const meId = await currentProfileId();
  const { data: mat, error } = await supabase
    .from("materials")
    .insert({
      name: input.name,
      category: input.category,
      unit: input.unit,
      stock: 0,
      threshold: input.threshold,
      supplier: input.supplier ?? null,
      created_by: meId,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.stock > 0) {
    await insertMaterialTransaction({
      materialId: mat.id,
      qtyDelta: input.stock,
      type: "adjustment",
      note: "Opening stock at material creation",
    });
  }
}

// ============ MATERIAL REQUESTS ============

type DbMaterialRequest = {
  id: string;
  project_id: string;
  material_id: string;
  requested_by: string;
  quantity: number;
  is_urgent: boolean;
  status: "pending" | "approved" | "denied" | "delivered";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const REQUEST_STATUS_LABEL: Record<DbMaterialRequest["status"], MaterialRequest["status"]> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  delivered: "Delivered",
};

export async function fetchMaterialRequests(): Promise<MaterialRequest[]> {
  const { data: rows, error } = await supabase
    .from("material_requests")
    .select(
      "id,project_id,material_id,requested_by,quantity,is_urgent,status,reviewed_by,reviewed_at,created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  const reqs = (rows as DbMaterialRequest[]) ?? [];
  if (reqs.length === 0) return [];

  const projectIds = Array.from(new Set(reqs.map((r) => r.project_id)));
  const materialIds = Array.from(new Set(reqs.map((r) => r.material_id)));
  const profileIds = Array.from(new Set(reqs.map((r) => r.requested_by)));

  const [projectsRes, materialsRes, profilesRes] = await Promise.all([
    supabase.from("projects").select("id,project_name").in("id", projectIds),
    supabase.from("materials").select("id,name,unit").in("id", materialIds),
    supabase.from("profiles").select("id,full_name").in("id", profileIds),
  ]);

  const projectMap = new Map(((projectsRes.data as ProjectMini[]) ?? []).map((p) => [p.id, p]));
  const materialMap = new Map(
    ((materialsRes.data as { id: string; name: string; unit: string }[]) ?? []).map((m) => [
      m.id,
      m,
    ]),
  );
  const profileMap = new Map(((profilesRes.data as ProfileMini[]) ?? []).map((p) => [p.id, p]));

  return reqs.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: projectMap.get(r.project_id)?.project_name,
    requestedBy: r.requested_by,
    requestedByName: profileMap.get(r.requested_by)?.full_name,
    materialId: r.material_id,
    material: materialMap.get(r.material_id)?.name ?? "Unknown material",
    unit: materialMap.get(r.material_id)?.unit ?? "",
    quantity: Number(r.quantity),
    status: REQUEST_STATUS_LABEL[r.status],
    createdAt: r.created_at,
    urgency: r.is_urgent ? "Urgent" : "Normal",
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
  }));
}

export async function raiseMaterialRequest(input: {
  projectId: string;
  materialId: string;
  quantity: number;
  isUrgent: boolean;
}) {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");
  const { error } = await supabase.from("material_requests").insert({
    project_id: input.projectId,
    material_id: input.materialId,
    requested_by: meId,
    quantity: input.quantity,
    is_urgent: input.isUrgent,
  });
  if (error) throw error;
  await notify({
    forRole: "project_manager",
    title: "New material request",
    body: `A material request for ${input.quantity} unit(s) is awaiting review.`,
    kind: input.isUrgent ? "warning" : "info",
    linkUrl: "/material-requests",
  });
}

/** Approve or deny a material request. Approving atomically decrements stock; fails loudly if stock is insufficient. */
export async function reviewMaterialRequest(
  request: MaterialRequest,
  decision: "approved" | "denied",
) {
  const meId = await currentProfileId();

  if (decision === "approved") {
    await insertMaterialTransaction({
      materialId: request.materialId,
      projectId: request.projectId,
      qtyDelta: -request.quantity,
      type: "usage",
      note: `Material request ${request.id} approved`,
    });
  }

  const { error } = await supabase
    .from("material_requests")
    .update({ status: decision, reviewed_by: meId, reviewed_at: new Date().toISOString() })
    .eq("id", request.id);
  if (error) throw error;

  await notify({
    forUserId: request.requestedBy,
    title: decision === "approved" ? "Material request approved" : "Material request denied",
    body: `Your request for ${request.quantity} ${request.unit} of ${request.material} was ${decision}.`,
    kind: decision === "approved" ? "success" : "danger",
    linkUrl: "/material-requests",
  });
}

export type MaterialUsageSummary = {
  materialId: string;
  materialName: string;
  unit: string;
  totalQty: number;
};

/** Per-material usage/delivery totals for a project's material transactions. */
export async function fetchMaterialTransactionsForProject(
  projectId: string,
): Promise<MaterialUsageSummary[]> {
  const { data: rows, error } = await supabase
    .from("material_transactions")
    .select("material_id,qty_delta")
    .eq("project_id", projectId);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const materialIds = Array.from(new Set(rows.map((r) => r.material_id)));
  const { data: materials, error: mErr } = await supabase
    .from("materials")
    .select("id,name,unit")
    .in("id", materialIds);
  if (mErr) throw mErr;
  const materialMap = new Map(
    ((materials as { id: string; name: string; unit: string }[]) ?? []).map((m) => [m.id, m]),
  );

  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.material_id, (totals.get(r.material_id) ?? 0) + Number(r.qty_delta));
  }

  return Array.from(totals.entries()).map(([materialId, totalQty]) => ({
    materialId,
    materialName: materialMap.get(materialId)?.name ?? "Unknown material",
    unit: materialMap.get(materialId)?.unit ?? "",
    totalQty,
  }));
}

// ============ ATTENDANCE / CLOCK ============

type DbAttendance = {
  id: string;
  profile_id: string;
  project_id: string | null;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  break_started_at: string | null;
  status: "active" | "on_break" | "completed";
};

const ATTENDANCE_STATUS_LABEL: Record<DbAttendance["status"], AttendanceLog["status"]> = {
  active: "Active",
  on_break: "On Break",
  completed: "Completed",
};

function mapAttendance(a: DbAttendance): AttendanceLog {
  return {
    id: a.id,
    userId: a.profile_id,
    projectId: a.project_id ?? undefined,
    clockIn: a.clock_in,
    clockOut: a.clock_out ?? undefined,
    breakMinutes: a.break_minutes,
    breakStartedAt: a.break_started_at,
    status: ATTENDANCE_STATUS_LABEL[a.status],
  };
}

/** All attendance logs from the last 7 days, for the admin/PM/supervisor table. */
export async function fetchAttendanceLogs(): Promise<AttendanceLog[]> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("id,profile_id,project_id,clock_in,clock_out,break_minutes,break_started_at,status")
    .gte("clock_in", since)
    .order("clock_in", { ascending: false });
  if (error) throw error;
  return ((data as DbAttendance[]) ?? []).map(mapAttendance);
}

/** Total hours worked (clocked minus breaks) over the last 7 days, for a worker's own performance stats. */
export async function fetchMyRecentHours(profileId: string): Promise<number> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("clock_in,clock_out,break_minutes")
    .eq("profile_id", profileId)
    .gte("clock_in", since);
  if (error) throw error;
  const totalMs = (data ?? []).reduce((sum, log) => {
    const start = new Date(log.clock_in).getTime();
    const end = log.clock_out ? new Date(log.clock_out).getTime() : Date.now();
    const breakMs = (log.break_minutes ?? 0) * 60_000;
    return sum + Math.max(0, end - start - breakMs);
  }, 0);
  return Math.round((totalMs / 3_600_000) * 10) / 10;
}

/** Profile ids currently clocked in (open attendance row), for a real "on-site now" indicator. */
export async function fetchOnSiteProfileIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("profile_id")
    .neq("status", "completed");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.profile_id));
}

/** The current user's still-open (not completed) attendance row, if any — used to restore clock state on load. */
export async function fetchMyOpenAttendance(): Promise<AttendanceLog | null> {
  const meId = await currentProfileId();
  if (!meId) return null;
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("id,profile_id,project_id,clock_in,clock_out,break_minutes,break_started_at,status")
    .eq("profile_id", meId)
    .neq("status", "completed")
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapAttendance(data as DbAttendance) : null;
}

export async function clockIn(projectId: string | null): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");
  const { error } = await supabase.from("attendance_logs").insert({
    profile_id: meId,
    project_id: projectId,
    status: "active",
  });
  if (error) throw error;
}

function accumulatedBreakMinutes(current: AttendanceLog): number {
  if (!current.breakStartedAt) return current.breakMinutes;
  const elapsed = Math.round((Date.now() - new Date(current.breakStartedAt).getTime()) / 60_000);
  return current.breakMinutes + Math.max(elapsed, 0);
}

/** Switch to a break (or start a new break, banking elapsed minutes from any prior break first). */
export async function startBreak(current: AttendanceLog): Promise<void> {
  const breakMinutes = accumulatedBreakMinutes(current);
  const { error } = await supabase
    .from("attendance_logs")
    .update({
      status: "on_break",
      break_minutes: breakMinutes,
      break_started_at: new Date().toISOString(),
    })
    .eq("id", current.id);
  if (error) throw error;
}

export async function clockOut(current: AttendanceLog): Promise<void> {
  const breakMinutes = accumulatedBreakMinutes(current);
  const { error } = await supabase
    .from("attendance_logs")
    .update({
      status: "completed",
      clock_out: new Date().toISOString(),
      break_minutes: breakMinutes,
      break_started_at: null,
    })
    .eq("id", current.id);
  if (error) throw error;
}

// ============ PROJECT CHAT ============

type DbChatMessage = {
  id: string;
  project_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
};

const CHAT_MESSAGE_COLUMNS =
  "id,project_id,sender_id,message,created_at,attachment_url,attachment_type,attachment_name,reply_to_id,edited_at,deleted_at";

function mapChatMessage(m: DbChatMessage): ChatMessage {
  return {
    id: m.id,
    projectId: m.project_id,
    userId: m.sender_id,
    text: m.message,
    at: m.created_at,
    attachmentUrl: m.attachment_url,
    attachmentType: m.attachment_type,
    attachmentName: m.attachment_name,
    replyToId: m.reply_to_id,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at,
  };
}

export async function fetchChatMessages(projectId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(CHAT_MESSAGE_COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data as DbChatMessage[]) ?? []).map(mapChatMessage);
}

export async function editChatMessage(messageId: string, text: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .update({ message: text, edited_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

/** Marks the project's chat as read up to now for the current user. */
export async function markChatRead(projectId: string): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) return;
  const { error } = await supabase
    .from("chat_reads")
    .upsert(
      { project_id: projectId, user_id: meId, last_read_at: new Date().toISOString() },
      { onConflict: "project_id,user_id" },
    );
  if (error) throw error;
}

export type ChatRead = { userId: string; lastReadAt: string };

/** Every project member's read pointer, used to derive "seen" ticks. */
export async function fetchChatReads(projectId: string): Promise<ChatRead[]> {
  const { data, error } = await supabase
    .from("chat_reads")
    .select("user_id,last_read_at")
    .eq("project_id", projectId);
  if (error) throw error;
  return (data ?? []).map((r) => ({ userId: r.user_id, lastReadAt: r.last_read_at }));
}

/** Count of other people's messages sent since this user last read each project's
 * chat — used for a real "unread chats" dashboard stat. */
export async function fetchUnreadChatCount(profileId: string): Promise<number> {
  const [{ data: messages, error: msgError }, { data: reads, error: readError }] =
    await Promise.all([
      supabase
        .from("chat_messages")
        .select("project_id,created_at,sender_id")
        .neq("sender_id", profileId)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("chat_reads").select("project_id,last_read_at").eq("user_id", profileId),
    ]);
  if (msgError) throw msgError;
  if (readError) throw readError;
  const lastReadByProject = new Map((reads ?? []).map((r) => [r.project_id, r.last_read_at]));
  return (messages ?? []).filter((m) => {
    const lastRead = lastReadByProject.get(m.project_id);
    return !lastRead || new Date(m.created_at).getTime() > new Date(lastRead).getTime();
  }).length;
}

function mapReaction(r: {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}): ChatReaction {
  return { id: r.id, messageId: r.message_id, userId: r.user_id, emoji: r.emoji };
}

export async function fetchChatReactions(messageIds: string[]): Promise<ChatReaction[]> {
  if (messageIds.length === 0) return [];
  const { data, error } = await supabase
    .from("chat_reactions")
    .select("id,message_id,user_id,emoji")
    .in("message_id", messageIds);
  if (error) throw error;
  return (data ?? []).map(mapReaction);
}

/** Set (or change) the current user's reaction on a message. */
export async function setChatReaction(messageId: string, emoji: string): Promise<ChatReaction> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("chat_reactions")
    .upsert({ message_id: messageId, user_id: meId, emoji }, { onConflict: "message_id,user_id" })
    .select("id,message_id,user_id,emoji")
    .single();
  if (error) throw error;
  return mapReaction(data);
}

export async function removeChatReaction(messageId: string): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) return;
  const { error } = await supabase
    .from("chat_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", meId);
  if (error) throw error;
}

export type ChatAttachment = { url: string; type: string; name: string };

/** Upload a chat file/image to Storage. Returns the storage path plus display metadata. */
export async function uploadChatAttachment(projectId: string, file: File): Promise<ChatAttachment> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("chat-attachments")
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return { url: path, type: file.type || "application/octet-stream", name: file.name };
}

/** Signed, time-limited URLs for private chat-attachments storage paths, keyed by path. */
export async function getSignedChatUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from("chat-attachments")
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

export async function sendChatMessage(
  projectId: string,
  text: string,
  attachment?: ChatAttachment | null,
  replyToId?: string | null,
): Promise<ChatMessage> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      project_id: projectId,
      sender_id: meId,
      message: text,
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
      reply_to_id: replyToId ?? null,
    })
    .select(CHAT_MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return mapChatMessage(data as DbChatMessage);
}

// ============ PROJECT TEMPLATES ============

export type TemplateTaskInput = {
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  days: number;
};
export type TemplatePhaseInput = {
  name: string;
  description?: string | null;
  tasks: TemplateTaskInput[];
};
export type TemplateInput = {
  name: string;
  description?: string | null;
  category: string;
  phases: TemplatePhaseInput[];
};

export type TemplateFull = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  phases: {
    name: string;
    description: string | null;
    tasks: {
      id: string;
      title: string;
      description: string | null;
      priority: string;
      days: number;
    }[];
  }[];
};

type DbTemplateRow = {
  id: string;
  template_name: string;
  description: string | null;
  category: string;
};
type DbTaskTemplateRow = {
  id: string;
  project_template_id: string;
  phase_name: string;
  phase_description: string | null;
  task_title: string;
  task_description: string | null;
  sort_order: number;
  default_priority: string;
  estimated_duration_days: number | null;
};

export async function fetchTemplates(): Promise<TemplateFull[]> {
  const { data: tpls, error } = await supabase
    .from("project_templates")
    .select("id,template_name,description,category")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const { data: tasks, error: tErr } = await supabase
    .from("task_templates")
    .select(
      "id,project_template_id,phase_name,phase_description,task_title,task_description,sort_order,default_priority,estimated_duration_days",
    )
    .order("sort_order", { ascending: true });
  if (tErr) throw tErr;

  return ((tpls as DbTemplateRow[]) ?? []).map((tpl) => {
    const ttasks = ((tasks as DbTaskTemplateRow[]) ?? []).filter(
      (t) => t.project_template_id === tpl.id,
    );
    const phaseOrder: string[] = [];
    const descByPhase = new Map<string, string | null>();
    const groups = new Map<string, DbTaskTemplateRow[]>();
    for (const t of ttasks) {
      if (!groups.has(t.phase_name)) {
        phaseOrder.push(t.phase_name);
        groups.set(t.phase_name, []);
        descByPhase.set(t.phase_name, t.phase_description);
      }
      groups.get(t.phase_name)!.push(t);
    }
    return {
      id: tpl.id,
      name: tpl.template_name,
      description: tpl.description,
      category: tpl.category,
      phases: phaseOrder.map((name) => ({
        name,
        description: descByPhase.get(name) ?? null,
        tasks: groups.get(name)!.map((t) => ({
          id: t.id,
          title: t.task_title,
          description: t.task_description,
          priority: t.default_priority,
          days: t.estimated_duration_days ?? 1,
        })),
      })),
    };
  });
}

function flattenTemplateTasks(templateId: string, phases: TemplatePhaseInput[]) {
  let order = 0;
  const rows: {
    project_template_id: string;
    phase_name: string;
    phase_description: string | null;
    task_title: string;
    task_description: string | null;
    sort_order: number;
    default_priority: TemplateTaskInput["priority"];
    estimated_duration_days: number;
  }[] = [];
  for (const phase of phases) {
    for (const task of phase.tasks) {
      order += 10;
      rows.push({
        project_template_id: templateId,
        phase_name: phase.name,
        phase_description: phase.description ?? null,
        task_title: task.title,
        task_description: task.description ?? null,
        sort_order: order,
        default_priority: task.priority,
        estimated_duration_days: task.days,
      });
    }
  }
  return rows;
}

export async function createTemplate(input: TemplateInput): Promise<string> {
  const { data: tpl, error: tErr } = await supabase
    .from("project_templates")
    .insert({
      template_name: input.name,
      description: input.description ?? null,
      category: input.category,
    })
    .select("id")
    .single();
  if (tErr) throw tErr;

  const rows = flattenTemplateTasks(tpl.id, input.phases);
  if (rows.length) {
    const { error: ttErr } = await supabase.from("task_templates").insert(rows);
    if (ttErr) throw ttErr;
  }
  return tpl.id;
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<void> {
  const { error: tErr } = await supabase
    .from("project_templates")
    .update({
      template_name: input.name,
      description: input.description ?? null,
      category: input.category,
    })
    .eq("id", id);
  if (tErr) throw tErr;

  const { error: delErr } = await supabase
    .from("task_templates")
    .delete()
    .eq("project_template_id", id);
  if (delErr) throw delErr;

  const rows = flattenTemplateTasks(id, input.phases);
  if (rows.length) {
    const { error: ttErr } = await supabase.from("task_templates").insert(rows);
    if (ttErr) throw ttErr;
  }
}

export async function archiveTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("project_templates")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw error;
}

export type DbNotification = {
  id: string;
  for_user_id: string | null;
  for_role: Role | null;
  title: string;
  body: string | null;
  kind: "info" | "warning" | "success" | "danger";
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

/** Notifications visible to the current user, per RLS (own + role broadcasts),
 * minus any this user has dismissed from their own list. */
export async function fetchNotifications(): Promise<Notification[]> {
  const meId = await currentProfileId();
  const [{ data, error }, { data: dismissed, error: dismissedError }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,for_user_id,for_role,title,body,kind,link_url,is_read,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    meId
      ? supabase.from("notification_dismissals").select("notification_id").eq("profile_id", meId)
      : Promise.resolve({ data: [] as { notification_id: string }[], error: null }),
  ]);
  if (error) throw error;
  if (dismissedError) throw dismissedError;
  const dismissedIds = new Set((dismissed ?? []).map((d) => d.notification_id));
  return ((data ?? []) as DbNotification[])
    .filter((n) => !dismissedIds.has(n.id))
    .map((n) => ({
      id: n.id,
      forRole: n.for_role ?? undefined,
      forUserId: n.for_user_id ?? undefined,
      title: n.title,
      body: n.body ?? "",
      at: n.created_at,
      kind: n.kind,
      read: n.is_read,
    }));
}

/** Hide a notification from the current user's own list only — other
 * recipients (role broadcasts, or admins/PMs who can see everyone's) still
 * see it. */
export async function dismissNotification(id: string): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("notification_dismissals")
    .upsert(
      { profile_id: meId, notification_id: id },
      { onConflict: "profile_id,notification_id" },
    );
  if (error) throw error;
}

/** Clear every notification currently visible to this user. */
export async function dismissAllNotifications(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");
  const { error } = await supabase.from("notification_dismissals").upsert(
    ids.map((notification_id) => ({ profile_id: meId, notification_id })),
    { onConflict: "profile_id,notification_id" },
  );
  if (error) throw error;
}

/** Unread count for the bell badge — only personal notifications are
 * individually read-tracked; role broadcasts have no per-user read state. */
export async function fetchUnreadNotificationCount(profileId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("for_user_id", profileId)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export type UploadPhoto = {
  id: string;
  projectId: string;
  projectName: string;
  taskId: string | null;
  fileUrl: string;
  fileType: string | null;
  category: string;
  note: string | null;
  createdAt: string;
};

/** Photos uploaded across projects visible to the current user (RLS-scoped). */
export async function fetchMyUploads(): Promise<UploadPhoto[]> {
  const { data, error } = await supabase
    .from("task_photos")
    .select("id,project_id,task_id,file_url,file_type,upload_category,note,created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const projectIds = Array.from(new Set(rows.map((r) => r.project_id)));
  const { data: projects } = await supabase
    .from("projects")
    .select("id,project_name")
    .in("id", projectIds);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.project_name]));

  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: projectMap.get(r.project_id) ?? "—",
    taskId: r.task_id,
    fileUrl: r.file_url,
    fileType: r.file_type,
    category: r.upload_category ?? "progress",
    note: r.note,
    createdAt: r.created_at,
  }));
}

/** Signed, time-limited URLs for private-bucket storage paths, keyed by path. */
export async function getSignedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from("task-photos").createSignedUrls(paths, 3600);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl);
  }
  return map;
}

/** Upload a site photo to Storage and record it against a project (and optionally a task). */
export async function uploadTaskPhoto(input: {
  projectId: string;
  taskId?: string | null;
  file: File;
  category: string;
  note?: string | null;
}): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");

  const ext = input.file.name.includes(".") ? input.file.name.split(".").pop() : "jpg";
  const path = `${input.projectId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("task-photos")
    .upload(path, input.file, { contentType: input.file.type || undefined });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase.from("task_photos").insert({
    project_id: input.projectId,
    task_id: input.taskId || null,
    uploaded_by: meId,
    file_url: path,
    file_type: input.file.type || null,
    upload_category: input.category,
    note: input.note || null,
  });
  if (insertError) {
    await supabase.storage.from("task-photos").remove([path]);
    throw insertError;
  }
}

// ============ TASK SUGGESTIONS ============
// Workers/subcontractors propose a task; admins/PMs approve (creates a real
// task, unassigned to any phase yet), reject, or delete it outright.

export type TaskSuggestion = {
  id: string;
  projectId: string;
  projectName?: string;
  suggestedBy: string;
  suggestedByName?: string;
  title: string;
  description: string | null;
  urgency: DbPriority | null;
  photoUrl: string | null;
  status: string;
  reviewedBy: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export async function fetchTaskSuggestions(): Promise<TaskSuggestion[]> {
  const { data, error } = await supabase
    .from("task_suggestions")
    .select(
      "id,project_id,suggested_by,title,description,urgency,photo_url,status,reviewed_by,review_comment,reviewed_at,created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const projectIds = Array.from(new Set(rows.map((r) => r.project_id)));
  const profileIds = Array.from(new Set(rows.map((r) => r.suggested_by)));
  const [{ data: projects }, { data: profiles }] = await Promise.all([
    supabase.from("projects").select("id,project_name").in("id", projectIds),
    supabase.from("profiles").select("id,full_name").in("id", profileIds),
  ]);
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p.project_name]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: projectMap.get(r.project_id),
    suggestedBy: r.suggested_by,
    suggestedByName: profileMap.get(r.suggested_by),
    title: r.title,
    description: r.description,
    urgency: r.urgency,
    photoUrl: r.photo_url,
    status: r.status,
    reviewedBy: r.reviewed_by,
    reviewComment: r.review_comment,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  }));
}

export async function createTaskSuggestion(input: {
  projectId: string;
  title: string;
  description?: string | null;
  urgency: DbPriority;
  photo?: File | null;
}): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");

  let photoPath: string | null = null;
  if (input.photo) {
    const ext = input.photo.name.includes(".") ? input.photo.name.split(".").pop() : "jpg";
    photoPath = `${input.projectId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("task-photos")
      .upload(photoPath, input.photo, { contentType: input.photo.type || undefined });
    if (uploadError) throw uploadError;
  }

  const { error } = await supabase.from("task_suggestions").insert({
    project_id: input.projectId,
    suggested_by: meId,
    title: input.title,
    description: input.description || null,
    urgency: input.urgency,
    photo_url: photoPath,
  });
  if (error) {
    if (photoPath) await supabase.storage.from("task-photos").remove([photoPath]);
    throw error;
  }
}

export async function approveTaskSuggestion(suggestion: TaskSuggestion): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");

  const { error: taskError } = await supabase.from("tasks").insert({
    project_id: suggestion.projectId,
    task_title: suggestion.title,
    description: suggestion.description,
    priority: suggestion.urgency ?? "medium",
    status: "not_started",
  });
  if (taskError) throw taskError;

  const { error } = await supabase
    .from("task_suggestions")
    .update({ status: "approved", reviewed_by: meId, reviewed_at: new Date().toISOString() })
    .eq("id", suggestion.id);
  if (error) throw error;

  await supabase.from("notifications").insert({
    for_user_id: suggestion.suggestedBy,
    kind: "success",
    title: "Task suggestion approved",
    body: `"${suggestion.title}" was added to the task list.`,
  });
}

export async function rejectTaskSuggestion(
  suggestion: TaskSuggestion,
  comment?: string | null,
): Promise<void> {
  const meId = await currentProfileId();
  if (!meId) throw new Error("Not signed in");
  const { error } = await supabase
    .from("task_suggestions")
    .update({
      status: "rejected",
      reviewed_by: meId,
      reviewed_at: new Date().toISOString(),
      review_comment: comment || null,
    })
    .eq("id", suggestion.id);
  if (error) throw error;

  await supabase.from("notifications").insert({
    for_user_id: suggestion.suggestedBy,
    kind: "warning",
    title: "Task suggestion not approved",
    body: comment || `"${suggestion.title}" was not approved.`,
  });
}

export async function deleteTaskSuggestion(id: string): Promise<void> {
  const { error } = await supabase.from("task_suggestions").delete().eq("id", id);
  if (error) throw error;
}

export type ProjectExpense = {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  category: string | null;
  createdAt: string;
};

export async function fetchProjectExpenses(projectId: string): Promise<ProjectExpense[]> {
  const { data, error } = await supabase
    .from("project_expenses")
    .select("id,project_id,description,amount,category,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    projectId: e.project_id,
    description: e.description,
    amount: Number(e.amount),
    category: e.category,
    createdAt: e.created_at,
  }));
}

export async function addProjectExpense(input: {
  projectId: string;
  description: string;
  amount: number;
  category?: string | null;
}): Promise<void> {
  const meId = await currentProfileId();
  const { error } = await supabase.from("project_expenses").insert({
    project_id: input.projectId,
    description: input.description,
    amount: input.amount,
    category: input.category || null,
    created_by: meId,
  });
  if (error) throw error;
}

export async function deleteProjectExpense(id: string): Promise<void> {
  const { error } = await supabase.from("project_expenses").delete().eq("id", id);
  if (error) throw error;
}

export type ProjectBudgetSummary = {
  projectId: string;
  projectName: string;
  budget: number | null;
  spent: number;
};

/** Budget vs. actuals across every non-archived project, for the Reports export. */
export async function fetchBudgetSummary(): Promise<ProjectBudgetSummary[]> {
  const { data: projects, error: pErr } = await supabase
    .from("projects")
    .select("id,project_name,budget")
    .eq("is_archived", false)
    .order("project_name", { ascending: true });
  if (pErr) throw pErr;
  const rows = projects ?? [];
  if (rows.length === 0) return [];

  const { data: expenses, error: eErr } = await supabase
    .from("project_expenses")
    .select("project_id,amount")
    .in(
      "project_id",
      rows.map((p) => p.id),
    );
  if (eErr) throw eErr;

  const spentByProject = new Map<string, number>();
  for (const e of expenses ?? []) {
    spentByProject.set(e.project_id, (spentByProject.get(e.project_id) ?? 0) + Number(e.amount));
  }

  return rows.map((p) => ({
    projectId: p.id,
    projectName: p.project_name,
    budget: p.budget,
    spent: spentByProject.get(p.id) ?? 0,
  }));
}
