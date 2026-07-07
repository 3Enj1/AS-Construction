// Demo data for the AS Construction MVP. Structured so it can be removed
// before production by deleting this file and the imports in mock pages.
import type {
  AttendanceLog,
  ChatMessage,
  Material,
  MaterialRequest,
  Notification,
  Project,
  ProjectTemplate,
  Task,
  User,
} from "./types";

export const DEMO_USERS: User[] = [
  {
    id: "u-admin",
    employeeCode: "ASC-ADM-001",
    password: "Admin@123",
    name: "Andrew Stuart",
    role: "admin",
    email: "andrew@as-construction.co",
    avatarColor: "oklch(0.62 0.22 27)",
    jobTitle: "Founder & Director",
    phone: "+27 82 000 0001",
  },
  {
    id: "u-pm",
    employeeCode: "ASC-PM-001",
    password: "Manager@123",
    name: "Lerato Mokoena",
    role: "project_manager",
    email: "lerato@as-construction.co",
    avatarColor: "oklch(0.7 0.13 230)",
    jobTitle: "Senior Project Manager",
    phone: "+27 82 000 0002",
  },
  {
    id: "u-ss",
    employeeCode: "ASC-SS-001",
    password: "Foreman@123",
    name: "Pieter van Wyk",
    role: "site_supervisor",
    email: "pieter@as-construction.co",
    avatarColor: "oklch(0.78 0.16 75)",
    jobTitle: "Site Supervisor / Foreman",
    phone: "+27 82 000 0003",
  },
  {
    id: "u-w1",
    employeeCode: "ASC-WRK-001",
    password: "Worker@123",
    name: "Sipho Ndlovu",
    role: "worker",
    email: "sipho@as-construction.co",
    avatarColor: "oklch(0.7 0.16 152)",
    jobTitle: "Bricklayer",
    phone: "+27 82 000 0004",
  },
  {
    id: "u-w2",
    employeeCode: "ASC-WRK-002",
    password: "Worker@123",
    name: "Thabo Khumalo",
    role: "worker",
    email: "thabo@as-construction.co",
    avatarColor: "oklch(0.65 0.15 320)",
    jobTitle: "Carpenter",
  },
  {
    id: "u-w3",
    employeeCode: "ASC-WRK-003",
    password: "Worker@123",
    name: "Johan Bekker",
    role: "worker",
    email: "johan@as-construction.co",
    avatarColor: "oklch(0.6 0.15 200)",
    jobTitle: "General Worker",
  },
  {
    id: "u-sub",
    employeeCode: "ASC-SUB-001",
    password: "Sub@123",
    name: "Capetown Electrical (Pty) Ltd",
    role: "subcontractor",
    email: "ops@ctelec.co.za",
    avatarColor: "oklch(0.72 0.12 60)",
    jobTitle: "Electrical Subcontractor",
  },
  {
    id: "u-cl",
    employeeCode: "ASC-CL-001",
    password: "Client@123",
    name: "Mr & Mrs Patel",
    role: "client",
    email: "patel.family@example.com",
    avatarColor: "oklch(0.68 0.1 290)",
    jobTitle: "Homeowner — Constantia Build",
  },
];

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "tpl-residential",
    name: "New Residential Home Build",
    description:
      "Full-cycle residential build template covering planning through handover.",
    phases: [
      {
        name: "Planning & Approvals",
        tasks: ["Site survey", "Architectural drawings sign-off", "Submit council plans"],
      },
      {
        name: "Site Preparation",
        tasks: ["Clear site", "Setup site office & ablutions", "Mark out building lines"],
      },
      {
        name: "Foundations",
        tasks: ["Excavate foundation trenches", "Pour footings", "Inspect & sign off foundation"],
      },
      {
        name: "Structure / Brickwork",
        tasks: ["Build perimeter walls to DPC", "Build superstructure walls", "Install lintels"],
      },
      {
        name: "Roofing",
        tasks: ["Install roof trusses", "Lay roof sheeting / tiles", "Fit gutters & downpipes"],
      },
      {
        name: "Plumbing & Electrical Coordination",
        tasks: ["First-fix plumbing", "First-fix electrical", "Pressure test water lines"],
      },
      {
        name: "Plastering & Finishes",
        tasks: ["Internal plastering", "Tiling — wet areas", "Paint — interior & exterior"],
      },
      {
        name: "Snagging & Quality Check",
        tasks: ["Internal snag list", "Client walkthrough", "Resolve snag items"],
      },
      {
        name: "Final Handover",
        tasks: ["Clean site", "Issue completion certificate", "Hand over keys to client"],
      },
    ],
  },
  {
    id: "tpl-reno",
    name: "Residential Renovation",
    description: "Mid-scale renovation template — kitchens, bathrooms, extensions.",
    phases: [
      { name: "Scoping", tasks: ["Site visit", "Scope document", "Client sign-off"] },
      { name: "Strip-out", tasks: ["Demolition", "Waste removal"] },
      { name: "Rebuild", tasks: ["Brickwork", "Plumbing & Electrical", "Finishes"] },
      { name: "Handover", tasks: ["Snag list", "Clean & handover"] },
    ],
  },
];

export const DEMO_PROJECTS: Project[] = [
  {
    id: "p-001",
    code: "ASC-2025-014",
    name: "Constantia Residence",
    client: "Mr & Mrs Patel",
    address: "14 Oakwood Drive, Constantia, Cape Town",
    status: "In Progress",
    progress: 46,
    startDate: "2025-08-04",
    targetDate: "2026-07-30",
    managerId: "u-pm",
    supervisorId: "u-ss",
    teamIds: ["u-w1", "u-w2", "u-w3", "u-sub"],
    budget: 6_450_000,
    spent: 2_780_000,
    coverGradient:
      "linear-gradient(135deg, oklch(0.35 0.08 27) 0%, oklch(0.22 0.02 270) 60%)",
    phases: [
      { id: "ph-1", name: "Planning & Approvals", order: 1, progress: 100 },
      { id: "ph-2", name: "Site Preparation", order: 2, progress: 100 },
      { id: "ph-3", name: "Foundations", order: 3, progress: 100 },
      { id: "ph-4", name: "Structure / Brickwork", order: 4, progress: 75 },
      { id: "ph-5", name: "Roofing", order: 5, progress: 20 },
      { id: "ph-6", name: "Plumbing & Electrical", order: 6, progress: 10 },
      { id: "ph-7", name: "Plastering & Finishes", order: 7, progress: 0 },
      { id: "ph-8", name: "Snagging & QC", order: 8, progress: 0 },
      { id: "ph-9", name: "Final Handover", order: 9, progress: 0 },
    ],
  },
  {
    id: "p-002",
    code: "ASC-2025-018",
    name: "Bishopscourt Extension",
    client: "Williams Family",
    address: "8 Klein Constantia Rd, Bishopscourt",
    status: "Awaiting Materials",
    progress: 22,
    startDate: "2025-10-12",
    targetDate: "2026-04-20",
    managerId: "u-pm",
    supervisorId: "u-ss",
    teamIds: ["u-w2", "u-w3"],
    budget: 1_950_000,
    spent: 430_000,
    coverGradient:
      "linear-gradient(135deg, oklch(0.3 0.06 230) 0%, oklch(0.22 0.02 270) 60%)",
    phases: [
      { id: "ph2-1", name: "Planning & Approvals", order: 1, progress: 100 },
      { id: "ph2-2", name: "Site Preparation", order: 2, progress: 60 },
      { id: "ph2-3", name: "Foundations", order: 3, progress: 0 },
      { id: "ph2-4", name: "Structure", order: 4, progress: 0 },
    ],
  },
];

export const DEMO_TASKS: Task[] = [
  {
    id: "t-1",
    projectId: "p-001",
    phaseId: "ph-4",
    title: "Build perimeter walls — north elevation",
    status: "In Progress",
    assignedTo: ["u-w1", "u-w3"],
    dueDate: "2026-05-20",
    priority: "High",
    progress: 65,
    description: "Continue brickwork up to lintel height on north elevation.",
  },
  {
    id: "t-2",
    projectId: "p-001",
    phaseId: "ph-4",
    title: "Install lintels — ground floor openings",
    status: "Assigned",
    assignedTo: ["u-w2"],
    dueDate: "2026-05-22",
    priority: "Medium",
    progress: 0,
  },
  {
    id: "t-3",
    projectId: "p-001",
    phaseId: "ph-5",
    title: "Install roof trusses — section A",
    status: "Awaiting Materials",
    assignedTo: ["u-w1", "u-w2"],
    dueDate: "2026-05-28",
    priority: "High",
    progress: 10,
  },
  {
    id: "t-4",
    projectId: "p-001",
    phaseId: "ph-6",
    title: "First-fix electrical rough-in",
    status: "Submitted for Review",
    assignedTo: ["u-sub"],
    dueDate: "2026-05-15",
    priority: "Critical",
    progress: 100,
  },
  {
    id: "t-5",
    projectId: "p-001",
    phaseId: "ph-3",
    title: "Foundation snag — south corner",
    status: "Overdue",
    assignedTo: ["u-w3"],
    dueDate: "2026-05-10",
    priority: "Critical",
    progress: 40,
  },
  {
    id: "t-6",
    projectId: "p-002",
    phaseId: "ph2-2",
    title: "Site clearing & marking",
    status: "In Progress",
    assignedTo: ["u-w3"],
    dueDate: "2026-05-19",
    priority: "Medium",
    progress: 60,
  },
  {
    id: "t-7",
    projectId: "p-002",
    phaseId: "ph2-3",
    title: "Excavate foundation trenches",
    status: "Blocked",
    assignedTo: ["u-w2"],
    dueDate: "2026-05-25",
    priority: "High",
    progress: 0,
    description: "Blocked — awaiting excavator delivery.",
  },
];

export const DEMO_MATERIALS: Material[] = [
  { id: "m-1", name: "Cement (50kg)", category: "Bulk", stock: 38, unit: "bags", threshold: 50, supplier: "PPC Cement" },
  { id: "m-2", name: "Building Sand", category: "Bulk", stock: 12, unit: "m³", threshold: 8, supplier: "Afrisam" },
  { id: "m-3", name: "Stock Bricks", category: "Bricks", stock: 4200, unit: "bricks", threshold: 5000, supplier: "Corobrik" },
  { id: "m-4", name: "Roof Trusses (custom)", category: "Roofing", stock: 0, unit: "sets", threshold: 1, supplier: "MiTek SA" },
  { id: "m-5", name: "Electrical Cable 2.5mm", category: "Electrical", stock: 320, unit: "m", threshold: 200, supplier: "Aberdare" },
  { id: "m-6", name: "PVC Plumbing Pipes 110mm", category: "Plumbing", stock: 28, unit: "lengths", threshold: 15, supplier: "DPI Plastics" },
];

export const DEMO_MATERIAL_REQUESTS: MaterialRequest[] = [
  { id: "mr-1", projectId: "p-001", requestedBy: "u-ss", material: "Roof Trusses (custom)", quantity: "1 set", status: "Pending", urgency: "Urgent", createdAt: "2026-05-14T08:12:00Z" },
  { id: "mr-2", projectId: "p-001", requestedBy: "u-w1", material: "Stock Bricks", quantity: "2,500 bricks", status: "Approved", urgency: "Normal", createdAt: "2026-05-13T14:01:00Z" },
  { id: "mr-3", projectId: "p-002", requestedBy: "u-ss", material: "Building Sand", quantity: "6 m³", status: "Delivered", urgency: "Normal", createdAt: "2026-05-10T09:30:00Z" },
  { id: "mr-4", projectId: "p-001", requestedBy: "u-w2", material: "Cement (50kg)", quantity: "40 bags", status: "Pending", urgency: "Urgent", createdAt: "2026-05-15T07:42:00Z" },
];

export const DEMO_ATTENDANCE: AttendanceLog[] = [
  { id: "a-1", userId: "u-w1", projectId: "p-001", clockIn: "2026-05-16T06:55:00Z", breakMinutes: 30, status: "Active" },
  { id: "a-2", userId: "u-w2", projectId: "p-001", clockIn: "2026-05-16T06:58:00Z", breakMinutes: 0, status: "On Break" },
  { id: "a-3", userId: "u-w3", projectId: "p-002", clockIn: "2026-05-16T07:02:00Z", clockOut: "2026-05-16T15:30:00Z", breakMinutes: 45, status: "Completed" },
];

export const DEMO_CHAT: ChatMessage[] = [
  { id: "c-1", projectId: "p-001", userId: "u-ss", text: "Morning team — trusses still delayed, push brickwork up to lintel today.", at: "2026-05-16T06:30:00Z" },
  { id: "c-2", projectId: "p-001", userId: "u-w1", text: "Copy that, north elevation will be done by lunch 👍", at: "2026-05-16T06:34:00Z" },
  { id: "c-3", projectId: "p-001", userId: "u-pm", text: "Andrew is doing a site walk at 14h00, please make sure the work area is tidy.", at: "2026-05-16T06:45:00Z" },
  { id: "c-4", projectId: "p-001", userId: "u-admin", text: "Thanks Lerato. I'll bring the client at 14h30.", at: "2026-05-16T06:51:00Z" },
];

export const DEMO_NOTIFICATIONS: Notification[] = [
  { id: "n-1", forRole: "admin", title: "Material request awaiting approval", body: "Pieter requested 1 set of roof trusses for Constantia Residence.", at: "2026-05-16T07:10:00Z", kind: "warning" },
  { id: "n-2", forRole: "admin", title: "Task overdue", body: "Foundation snag — south corner is 6 days overdue.", at: "2026-05-16T06:30:00Z", kind: "danger" },
  { id: "n-3", forRole: "project_manager", title: "Sub submitted work for review", body: "Capetown Electrical submitted first-fix electrical for review.", at: "2026-05-15T17:02:00Z", kind: "info" },
  { id: "n-4", forUserId: "u-w1", title: "New task assigned", body: "Build perimeter walls — north elevation.", at: "2026-05-16T06:00:00Z", kind: "info" },
  { id: "n-5", forRole: "site_supervisor", title: "Low stock alert", body: "Stock bricks below threshold (4,200 / 5,000).", at: "2026-05-15T11:20:00Z", kind: "warning" },
];

export const ACK_TEXT =
  "I acknowledge that I will use the AS Construction system responsibly, provide accurate project and task updates, respect client/project confidentiality, and follow all relevant AS Construction site, safety, and company procedures.";
