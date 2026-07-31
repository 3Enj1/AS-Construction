import type { Task, TaskStatus } from "./types";

export type DbTaskStatus =
  | "not_started" | "assigned" | "in_progress" | "blocked"
  | "awaiting_materials" | "submitted_for_review" | "approved"
  | "rejected" | "overdue" | "archived";

export type DbPriority = "low" | "medium" | "high" | "urgent";

export const TASK_STATUS_DB_TO_UI: Record<DbTaskStatus, TaskStatus> = {
  not_started: "Not Started",
  assigned: "Assigned",
  in_progress: "In Progress",
  blocked: "Blocked",
  awaiting_materials: "Awaiting Materials",
  submitted_for_review: "Submitted for Review",
  approved: "Approved",
  rejected: "Rejected",
  overdue: "Overdue",
  archived: "Archived",
};

export const PRIORITY_DB_TO_UI: Record<DbPriority, Task["priority"]> = {
  low: "Low", medium: "Medium", high: "High", urgent: "Critical",
};
export const PRIORITY_UI_TO_DB: Record<Task["priority"], DbPriority> = {
  Low: "low", Medium: "medium", High: "high", Critical: "urgent",
};

export type Mini = { id: string; name: string; avatarColor: string } | null;

const AVATAR_COLORS = ["#F2994A","#F2C94C","#27AE60","#2D9CDB","#9B51E0","#EB5757","#56CCF2","#BB6BD9"];
export function colorFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export type DbTask = {
  id: string;
  task_title: string;
  description: string | null;
  status: DbTaskStatus;
  priority: DbPriority;
  due_date: string | null;
  project_id: string;
  phase_id: string | null;
  assigned_user_id: string | null;
  assigned_supervisor_id: string | null;
  is_archived: boolean;
  submitted_for_review_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  rejection_reason: string | null;
  client_visible?: boolean;
};

export type EnrichedTask = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  dbStatus: DbTaskStatus;
  priority: Task["priority"];
  dueDate: string | null;
  projectId: string;
  projectName?: string;
  projectCode?: string;
  phaseId: string | null;
  phaseName?: string;
  assignedUserId: string | null;
  supervisorId: string | null;
  assignees: NonNullable<Mini>[];
  supervisor: Mini;
  isArchived: boolean;
  submittedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  rejectionReason: string | null;
  clientVisible: boolean;
};

export function codeFromProjectId(id: string) {
  return "ASC-PRJ-" + id.slice(0, 6).toUpperCase();
}

export function enrichTask(
  t: DbTask,
  ctx: {
    project?: { id: string; project_name: string } | null;
    phase?: { id: string; phase_name: string } | null;
    assignedUser?: { id: string; full_name: string } | null;
    supervisor?: { id: string; full_name: string } | null;
  },
): EnrichedTask {
  const overdue =
    t.status !== "approved" && t.status !== "archived" &&
    t.due_date && new Date(t.due_date) < new Date();
  return {
    id: t.id,
    title: t.task_title,
    description: t.description,
    status: overdue ? "Overdue" : TASK_STATUS_DB_TO_UI[t.status],
    dbStatus: t.status,
    priority: PRIORITY_DB_TO_UI[t.priority] ?? "Medium",
    dueDate: t.due_date,
    projectId: t.project_id,
    projectName: ctx.project?.project_name,
    projectCode: ctx.project ? codeFromProjectId(ctx.project.id) : undefined,
    phaseId: t.phase_id,
    phaseName: ctx.phase?.phase_name,
    assignedUserId: t.assigned_user_id,
    supervisorId: t.assigned_supervisor_id,
    assignees: ctx.assignedUser
      ? [{ id: ctx.assignedUser.id, name: ctx.assignedUser.full_name, avatarColor: colorFromId(ctx.assignedUser.id) }]
      : [],
    supervisor: ctx.supervisor
      ? { id: ctx.supervisor.id, name: ctx.supervisor.full_name, avatarColor: colorFromId(ctx.supervisor.id) }
      : null,
    isArchived: t.is_archived,
    submittedAt: t.submitted_for_review_at,
    approvedAt: t.approved_at,
    completedAt: t.completed_at,
    rejectionReason: t.rejection_reason,
    clientVisible: t.client_visible ?? false,
  };
}
