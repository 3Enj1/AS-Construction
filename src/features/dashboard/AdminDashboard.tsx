import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { TaskTrendChart } from "@/components/dashboard/TaskTrendChart";
import { ProjectsMap } from "@/components/map/ProjectsMap";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { supabase } from "@/integrations/supabase/client";
import {
  attachProjectProgress,
  fetchEnrichedTasks,
  fetchProjectPins,
  fetchTaskCompletionTrend,
} from "@/lib/project-actions";
import { mapDbProject, type DbProject } from "@/lib/project-mapper";
import { relativeFromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Hammer,
  Info,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ACTIVITY_ICON: Record<string, LucideIcon> = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};
const ACTIVITY_TONE: Record<string, string> = {
  danger: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
};

function EmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="text-sm text-muted-foreground">{message}</div>
    </div>
  );
}

export function AdminDashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,project_name,client_name,client_profile_id,site_address,status,start_date,expected_completion_date,assigned_project_manager_id,assigned_site_supervisor_id",
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return attachProjectProgress(((data as DbProject[]) ?? []).map(mapDbProject));
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "admin-all"],
    queryFn: () => fetchEnrichedTasks(),
  });

  const { data: teamCount = 0 } = useQuery({
    queryKey: ["profiles-count-active"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_archived", false);
      return count ?? 0;
    },
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["notifications-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,kind,created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: trend = [] } = useQuery({
    queryKey: ["task-completion-trend"],
    queryFn: fetchTaskCompletionTrend,
  });

  const { data: pins = [] } = useQuery({
    queryKey: ["project-pins"],
    queryFn: fetchProjectPins,
  });

  const active = projects.filter((p) => p.status !== "Completed");
  const overdueTasks = tasks.filter((t) => t.status === "Overdue");
  const review = tasks.filter((t) => t.dbStatus === "submitted_for_review");
  const completed = tasks.filter((t) => t.dbStatus === "approved");
  const totalProgress =
    tasks.length === 0 ? 0 : Math.round((completed.length / tasks.length) * 100);

  return (
    <>
      <PageHeader
        title="Operations dashboard"
        subtitle="Live view of every project, request and site team."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/users">
                <Users className="size-4" /> Add user
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/approvals">
                <CheckCircle2 className="size-4" /> Approvals
              </Link>
            </Button>
            <Button variant="brand" asChild>
              <Link to="/projects">
                <Plus className="size-4" /> New project
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Active projects", value: active.length, icon: Hammer, tone: "brand" as const },
          {
            label: "Overdue tasks",
            value: overdueTasks.length,
            icon: AlertTriangle,
            tone: "danger" as const,
          },
          {
            label: "Awaiting approval",
            value: review.length,
            icon: CheckCircle2,
            tone: "warning" as const,
          },
          {
            label: "Completed tasks",
            value: completed.length,
            icon: CheckCircle2,
            tone: "info" as const,
          },
          {
            label: "Overall progress",
            value: `${totalProgress}%`,
            icon: Hammer,
            tone: "brand" as const,
          },
          { label: "Team members", value: teamCount, icon: Users, tone: "neutral" as const },
        ].map((s, idx) => (
          <div
            key={s.label}
            className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            <StatCard label={s.label} value={s.value} icon={s.icon} tone={s.tone} />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <TaskTrendChart data={trend} />
      </div>

      {pins.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <MapPin className="size-4" /> Where we've worked
            </h2>
            <Link to="/map" className="text-xs text-brand hover:underline">
              Full map →
            </Link>
          </div>
          <ProjectsMap pins={pins} height={280} scrollWheelZoom={false} />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Active projects
              <span className="grid size-5 place-items-center rounded-full bg-muted text-[11px] font-semibold normal-case tracking-normal text-foreground">
                {active.length}
              </span>
            </h2>
            <Link to="/projects" className="text-xs text-brand hover:underline">
              View all →
            </Link>
          </div>
          {active.length === 0 ? (
            <div className="as-card">
              <EmptyState icon={Hammer} message="No active projects yet." />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {active.map((p, idx) => (
                <div
                  key={p.id}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
                  style={{ animationDelay: `${idx * 70}ms` }}
                >
                  <ProjectCard project={p} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tasks awaiting approval
            </h2>
            <div className="as-card divide-y divide-border">
              {review.map((t) => (
                <div key={t.id} className="p-3.5">
                  <div className="text-[11px] text-muted-foreground font-mono">{t.projectCode}</div>
                  <div className="mt-0.5 text-sm font-medium leading-snug">{t.title}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusPill status={t.status} kind="task" />
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/approvals">Review</Link>
                    </Button>
                  </div>
                </div>
              ))}
              {review.length === 0 && (
                <EmptyState icon={ClipboardCheck} message="Nothing waiting on your review." />
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent activity
            </h2>
            <div className="as-card divide-y divide-border">
              {recent.length === 0 ? (
                <EmptyState icon={Bell} message="No recent activity." />
              ) : (
                recent.map((n) => {
                  const Icon = ACTIVITY_ICON[n.kind] ?? Info;
                  return (
                    <div key={n.id} className="flex gap-3 p-3.5">
                      <div
                        className={cn(
                          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
                          ACTIVITY_TONE[n.kind] ?? ACTIVITY_TONE.info,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-snug">{n.title}</div>
                        {n.body && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>
                        )}
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {relativeFromNow(n.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
