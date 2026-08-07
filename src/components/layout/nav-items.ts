import type { Role } from "@/lib/types";
import {
  Home,
  LayoutDashboard,
  Hammer,
  ClipboardList,
  CheckSquare,
  Package,
  PackagePlus,
  Clock,
  BarChart3,
  Users,
  MessageSquare,
  Bell,
  Settings,
  User as UserIcon,
  Briefcase,
  Image as ImageIcon,
  Trophy,
  FileBox,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
}

const MGMT_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", to: "/projects", icon: Hammer },
  { label: "Project Templates", to: "/templates", icon: FileBox },
  { label: "Project Map", to: "/map", icon: MapPin },
  { label: "Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Task Approvals", to: "/approvals", icon: CheckSquare },
  { label: "Materials", to: "/materials", icon: Package },
  { label: "Material Requests", to: "/material-requests", icon: PackagePlus },
  { label: "Reports", to: "/reports", icon: BarChart3 },
  { label: "Users", to: "/users", icon: Users },
  { label: "Project Chat", to: "/chat", icon: MessageSquare },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Settings", to: "/settings", icon: Settings },
];

const PM_NAV: NavItem[] = MGMT_NAV.filter(
  (i) => !["Users", "Settings", "Reports"].includes(i.label),
);

const SUPERVISOR_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", to: "/projects", icon: Hammer },
  { label: "Project Map", to: "/map", icon: MapPin },
  { label: "Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Task Approvals", to: "/approvals", icon: CheckSquare },
  { label: "Materials", to: "/materials", icon: Package },
  { label: "Material Requests", to: "/material-requests", icon: PackagePlus },
  { label: "Project Chat", to: "/chat", icon: MessageSquare },
  { label: "Notifications", to: "/notifications", icon: Bell },
];

const WORKER_NAV: NavItem[] = [
  { label: "Home", to: "/dashboard", icon: Home },
  { label: "My Tasks", to: "/tasks", icon: ClipboardList },
  { label: "Clock In", to: "/clock", icon: Clock },
  { label: "Uploads", to: "/uploads", icon: ImageIcon },
  { label: "Chat", to: "/chat", icon: MessageSquare },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "My Performance", to: "/performance", icon: Trophy },
  { label: "Profile", to: "/profile", icon: UserIcon },
];

const SUB_NAV: NavItem[] = [
  { label: "Assigned Work", to: "/tasks", icon: Briefcase },
  { label: "Uploads", to: "/uploads", icon: ImageIcon },
  { label: "Project Chat", to: "/chat", icon: MessageSquare },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Profile", to: "/profile", icon: UserIcon },
];

const CLIENT_NAV: NavItem[] = [
  { label: "Project Overview", to: "/dashboard", icon: LayoutDashboard },
  { label: "Approved Updates", to: "/notifications", icon: Bell },
  { label: "Photos", to: "/uploads", icon: ImageIcon },
  { label: "Profile", to: "/profile", icon: UserIcon },
];

export function getNavForRole(role: Role): NavItem[] {
  switch (role) {
    case "admin":
      return MGMT_NAV;
    case "project_manager":
      return PM_NAV;
    case "site_supervisor":
      return SUPERVISOR_NAV;
    case "worker":
      return WORKER_NAV;
    case "subcontractor":
      return SUB_NAV;
    case "client":
      return CLIENT_NAV;
  }
}

const ADMIN_MOBILE_NAV: NavItem[] = [
  { label: "Home", to: "/dashboard", icon: Home },
  { label: "Projects", to: "/projects", icon: Hammer },
  { label: "Chat", to: "/chat", icon: MessageSquare },
  { label: "Materials", to: "/materials", icon: Package },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function getMobileNavForRole(role: Role): NavItem[] {
  if (role === "admin") return ADMIN_MOBILE_NAV;
  // 5-item mobile bottom nav per role.
  const full = getNavForRole(role);
  const priority: Record<Exclude<Role, "admin">, string[]> = {
    project_manager: ["Dashboard", "Projects", "Task Approvals", "Material Requests", "Chat"],
    site_supervisor: ["Dashboard", "Tasks", "Task Approvals", "Materials", "Notifications"],
    worker: ["Home", "My Tasks", "Clock In", "Uploads", "Notifications"],
    subcontractor: ["Assigned Work", "Uploads", "Project Chat", "Notifications", "Profile"],
    client: ["Project Overview", "Approved Updates", "Photos", "Profile"],
  };
  const want = priority[role];
  const items = want
    .map((label) => full.find((i) => i.label === label || i.label.startsWith(label)))
    .filter((x): x is NavItem => !!x);
  return items.slice(0, 5);
}
