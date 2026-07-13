import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskTrendChart } from "@/components/dashboard/TaskTrendChart";
import { supabase } from "@/integrations/supabase/client";
import { fetchEnrichedTasks, fetchTaskCompletionTrend } from "@/lib/project-actions";
import { AlertTriangle, CheckCircle2, ClipboardList, HardHat } from "lucide-react";

export function SupervisorDashboard() {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "supervisor-all"],
    queryFn: () => fetchEnrichedTasks(),
  });
  const { data: projectCount = 0 } = useQuery({
    queryKey: ["projects-count-active"],
    queryFn: async () => {
      const { count } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("is_archived", false)
        .neq("status", "completed");
      return count ?? 0;
    },
  });
  const { data: trend = [] } = useQuery({
    queryKey: ["task-completion-trend"],
    queryFn: fetchTaskCompletionTrend,
  });

  const overdue = tasks.filter((t) => t.status === "Overdue");
  const awaitingReview = tasks.filter((t) => t.dbStatus === "submitted_for_review");
  const active = tasks.filter((t) => !["approved", "archived"].includes(t.dbStatus));

  return (
    <>
      <PageHeader title="Site Supervisor" subtitle="Today on the ground." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Projects" value={projectCount} icon={HardHat} tone="brand" />
        <StatCard label="Open tasks" value={active.length} icon={ClipboardList} tone="info" />
        <StatCard label="Overdue" value={overdue.length} icon={AlertTriangle} tone="danger" />
        <StatCard
          label="Awaiting review"
          value={awaitingReview.length}
          icon={CheckCircle2}
          tone="warning"
        />
      </div>
      <div className="mt-6">
        <TaskTrendChart data={trend} />
      </div>
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Today's tasks
      </h2>
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading tasks…</div>
      ) : active.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">No active tasks.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </>
  );
}
