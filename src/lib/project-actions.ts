import { supabase } from "@/integrations/supabase/client";
import type { DbTask } from "./task-mapper";
import { enrichTask, type EnrichedTask } from "./task-mapper";

export type ProjectMini = { id: string; project_name: string };
export type PhaseMini = { id: string; phase_name: string; project_id: string };
export type ProfileMini = { id: string; full_name: string };

/** Fetch all tasks the current user can read, fully enriched. */
export async function fetchEnrichedTasks(opts?: { assignedToProfileId?: string }): Promise<EnrichedTask[]> {
  let q = supabase
    .from("tasks")
    .select("id,task_title,description,status,priority,due_date,project_id,phase_id,assigned_user_id,assigned_supervisor_id,is_archived,submitted_for_review_at,approved_at,completed_at,rejection_reason")
    .eq("is_archived", false)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (opts?.assignedToProfileId) q = q.eq("assigned_user_id", opts.assignedToProfileId);
  const { data: tasks, error } = await q;
  if (error) throw error;
  const rows = (tasks as DbTask[]) ?? [];
  if (rows.length === 0) return [];

  const projectIds = Array.from(new Set(rows.map((t) => t.project_id)));
  const phaseIds = Array.from(new Set(rows.map((t) => t.phase_id).filter(Boolean) as string[]));
  const profileIds = Array.from(new Set(rows.flatMap((t) => [t.assigned_user_id, t.assigned_supervisor_id]).filter(Boolean) as string[]));

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
      phase: t.phase_id ? phaseMap.get(t.phase_id) ?? null : null,
      assignedUser: t.assigned_user_id ? profileMap.get(t.assigned_user_id) ?? null : null,
      supervisor: t.assigned_supervisor_id ? profileMap.get(t.assigned_supervisor_id) ?? null : null,
    }),
  );
}

/** Create a project, optionally generating phases + tasks from a template. */
export async function createProjectFromTemplate(input: {
  project_name: string;
  client_name?: string | null;
  site_address?: string | null;
  description?: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  start_date?: string | null;
  expected_completion_date?: string | null;
  template_id?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles").select("id").eq("auth_user_id", u.user!.id).maybeSingle();

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .insert({
      project_name: input.project_name,
      client_name: input.client_name ?? null,
      site_address: input.site_address ?? null,
      description: input.description ?? null,
      status: input.status,
      start_date: input.start_date ?? null,
      expected_completion_date: input.expected_completion_date ?? null,
      created_by: me?.id ?? null,
    })
    .select("id")
    .single();
  if (pErr) throw pErr;

  if (!input.template_id) return { projectId: project.id, phases: 0, tasks: 0 };

  const { data: tts, error: ttErr } = await supabase
    .from("task_templates")
    .select("phase_name,phase_description,task_title,task_description,default_priority,sort_order,estimated_duration_days")
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
    .from("project_phases").insert(phaseRows).select("id,phase_name");
  if (phErr) throw phErr;
  const phaseByName = new Map((phases ?? []).map((p) => [p.phase_name, p.id]));

  const startMs = input.start_date ? new Date(input.start_date).getTime() : null;
  const taskRows = (tts ?? []).map((t, idx) => {
    const days = t.estimated_duration_days ?? 7;
    const due = startMs ? new Date(startMs + idx * Math.max(days, 1) * 86_400_000).toISOString().slice(0, 10) : null;
    return {
      project_id: project.id,
      phase_id: phaseByName.get(t.phase_name) ?? null,
      task_title: t.task_title,
      description: t.task_description ?? null,
      priority: t.default_priority,
      status: "not_started" as const,
      due_date: due,
    };
  });
  if (taskRows.length) {
    const { error: tkErr } = await supabase.from("tasks").insert(taskRows);
    if (tkErr) throw tkErr;
  }

  return { projectId: project.id, phases: phaseRows.length, tasks: taskRows.length };
}

/** Returns the current user's profile id (cached short-term). */
let _meIdCache: { authId: string; profileId: string } | null = null;
export async function currentProfileId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  if (_meIdCache?.authId === data.user.id) return _meIdCache.profileId;
  const { data: p } = await supabase
    .from("profiles").select("id").eq("auth_user_id", data.user.id).maybeSingle();
  if (p) _meIdCache = { authId: data.user.id, profileId: p.id };
  return p?.id ?? null;
}
