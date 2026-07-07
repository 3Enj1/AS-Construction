import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AdminDashboard } from "@/features/dashboard/AdminDashboard";
import { ManagerDashboard } from "@/features/dashboard/ManagerDashboard";
import { SupervisorDashboard } from "@/features/dashboard/SupervisorDashboard";
import { WorkerDashboard } from "@/features/dashboard/WorkerDashboard";
import { SubcontractorDashboard } from "@/features/dashboard/SubcontractorDashboard";
import { ClientDashboard } from "@/features/dashboard/ClientDashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  switch (user.role) {
    case "admin":
      return <AdminDashboard />;
    case "project_manager":
      return <ManagerDashboard />;
    case "site_supervisor":
      return <SupervisorDashboard />;
    case "worker":
      return <WorkerDashboard />;
    case "subcontractor":
      return <SubcontractorDashboard />;
    case "client":
      return <ClientDashboard />;
  }
}
