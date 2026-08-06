export type Role =
  "admin" | "project_manager" | "site_supervisor" | "worker" | "subcontractor" | "client";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  site_supervisor: "Site Supervisor",
  worker: "Worker",
  subcontractor: "Subcontractor",
  client: "Client",
};

export interface User {
  id: string; // profile id
  authUserId?: string; // auth.users id
  employeeCode: string;
  name: string;
  role: Role;
  email: string;
  phone?: string;
  avatarColor: string;
  avatarUrl?: string | null;
  jobTitle: string;
  isActive?: boolean;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  /** legacy / demo only — never populated from Supabase */
  password?: string;
}

export type ProjectStatus =
  | "New"
  | "Planning"
  | "Awaiting Permits"
  | "Approved"
  | "Scheduled"
  | "In Progress"
  | "On Hold"
  | "Awaiting Materials"
  | "Quality Check"
  | "Completed"
  | "Cancelled";

export type TaskStatus =
  | "Not Started"
  | "Assigned"
  | "In Progress"
  | "Blocked"
  | "Awaiting Materials"
  | "Submitted for Review"
  | "Approved"
  | "Rejected"
  | "Overdue"
  | "Archived";

export interface Phase {
  id: string;
  name: string;
  order: number;
  progress: number;
}

export interface Task {
  id: string;
  projectId: string;
  phaseId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo: string[];
  dueDate: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  progress: number;
  notes?: string[];
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  clientProfileId: string | null;
  address: string;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  targetDate: string;
  managerId: string;
  supervisorId: string;
  teamIds: string[];
  budget: number;
  spent: number;
  phases: Phase[];
  coverGradient: string;
}

export interface MaterialRequest {
  id: string;
  projectId: string;
  projectName?: string;
  requestedBy: string;
  requestedByName?: string;
  materialId: string;
  material: string;
  unit: string;
  quantity: number;
  status: "Pending" | "Approved" | "Denied" | "Delivered";
  createdAt: string;
  urgency: "Normal" | "Urgent";
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Material {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  threshold: number;
  supplier: string;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  projectId?: string;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  breakStartedAt?: string | null;
  status: "Active" | "On Break" | "Completed";
}

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  text: string;
  at: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
}

export interface Notification {
  id: string;
  forRole?: Role;
  forUserId?: string;
  title: string;
  body: string;
  at: string;
  kind: "info" | "warning" | "success" | "danger";
  read?: boolean;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  phases: { name: string; tasks: string[] }[];
}
