import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { TaskTrendChart } from "@/components/dashboard/TaskTrendChart";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { supabase } from "@/integrations/supabase/client";
import { fetchEnrichedTasks, fetchTaskCompletionTrend } from "@/lib/project-actions";
import { mapDbProject, type DbProject } from "@/lib/project-mapper";
import { relativeFromNow } from "@/lib/format";
import { AlertTriangle, CheckCircle2, Hammer, Plus, Users } from "lucide-react";

export function AdminDashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,project_name,client_name,site_address,status,start_date,expected_completion_date,assigned_project_manager_id,assigned_site_supervisor_id",
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as DbProject[]) ?? []).map(mapDbProject);
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
        <StatCard label="Active projects" value={active.length} icon={Hammer} tone="brand" />
        <StatCard
          label="Overdue tasks"
          value={overdueTasks.length}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Awaiting approval"
          value={review.length}
          icon={CheckCircle2}
          tone="warning"
        />
        <StatCard
          label="Completed tasks"
          value={completed.length}
          icon={CheckCircle2}
          tone="info"
        />
        <StatCard label="Overall progress" value={`${totalProgress}%`} icon={Hammer} tone="brand" />
        <StatCard label="Team members" value={teamCount} icon={Users} tone="neutral" />
      </div>

      <div className="mt-6">
        <TaskTrendChart data={trend} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Active projects
            </h2>
            <Link to="/projects" className="text-xs text-brand hover:underline">
              View all →
            </Link>
          </div>
          {active.length === 0 ? (
            <div className="as-card p-6 text-sm text-muted-foreground">No active projects yet.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {active.map((p) => (
                <ProjectCard key={p.id} project={p} />
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
                <div className="p-4 text-sm text-muted-foreground">Nothing waiting.</div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent activity
            </h2>
            <div className="as-card divide-y divide-border">
              {recent.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No recent activity.</div>
              ) : (
                recent.map((n) => (
                  <div key={n.id} className="flex gap-3 p-3.5">
                    <div
                      className={
                        "mt-0.5 size-2 rounded-full " +
                        (n.kind === "danger"
                          ? "bg-danger"
                          : n.kind === "warning"
                            ? "bg-warning"
                            : n.kind === "success"
                              ? "bg-success"
                              : "bg-info")
                      }
                    />
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
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
