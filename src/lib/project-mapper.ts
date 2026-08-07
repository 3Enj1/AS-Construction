import type { Project, ProjectStatus } from "./types";

const STATUS_MAP: Record<string, ProjectStatus> = {
  planning: "Planning",
  active: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Cancelled",
};

export function gradientFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `linear-gradient(135deg, oklch(0.38 0.09 ${hue}), oklch(0.2 0.04 ${(hue + 60) % 360}))`;
}

function codeFromId(id: string) {
  return "ASC-PRJ-" + id.slice(0, 6).toUpperCase();
}

export type DbProject = {
  id: string;
  project_name: string;
  client_name: string | null;
  client_profile_id?: string | null;
  site_address: string | null;
  status: string;
  start_date: string | null;
  expected_completion_date: string | null;
  assigned_project_manager_id: string | null;
  assigned_site_supervisor_id: string | null;
  budget?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function mapDbProject(p: DbProject): Project {
  const team = [p.assigned_project_manager_id, p.assigned_site_supervisor_id].filter(
    Boolean,
  ) as string[];
  return {
    id: p.id,
    code: codeFromId(p.id),
    name: p.project_name,
    client: p.client_name ?? "—",
    clientProfileId: p.client_profile_id ?? null,
    address: p.site_address ?? "—",
    status: STATUS_MAP[p.status] ?? "Planning",
    progress: 0,
    startDate: p.start_date ?? new Date().toISOString(),
    targetDate: p.expected_completion_date ?? new Date().toISOString(),
    managerId: p.assigned_project_manager_id ?? "",
    supervisorId: p.assigned_site_supervisor_id ?? "",
    teamIds: team,
    budget: p.budget ?? 0,
    spent: 0,
    phases: [],
    coverGradient: gradientFromId(p.id),
    latitude: p.latitude ?? null,
    longitude: p.longitude ?? null,
  };
}
