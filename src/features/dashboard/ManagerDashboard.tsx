import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskTrendChart } from "@/components/dashboard/TaskTrendChart";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchEnrichedTasks, fetchTaskCompletionTrend } from "@/lib/project-actions";
import { CheckCircle2, ClipboardList, Hammer, MessageSquare } from "lucide-react";

export function ManagerDashboard() {
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: () => fetchEnrichedTasks(),
  });
  const { data: activeCount = 0 } = useQuery({
    queryKey: ["projects-active-count"],
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
  const review = tasks.filter((t) => t.dbStatus === "submitted_for_review");
  const open = tasks.filter((t) => t.dbStatus !== "approved" && t.dbStatus !== "archived").length;
  return (
    <>
      <PageHeader title="Project Manager" subtitle="All projects you oversee." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active projects" value={activeCount} icon={Hammer} tone="brand" />
        <StatCard label="Tasks open" value={open} icon={ClipboardList} tone="info" />
        <StatCard
          label="Awaiting approval"
          value={review.length}
          icon={CheckCircle2}
          tone="warning"
        />
        <StatCard label="New chat" value={0} icon={MessageSquare} />
      </div>
      <div className="mt-6">
        <TaskTrendChart data={trend} />
      </div>
      <h2 className="mt-10 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Awaiting your approval
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {review.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
        {review.length === 0 && (
          <div className="as-card p-6 text-sm text-muted-foreground">Nothing waiting.</div>
        )}
      </div>
    </>
  );
}
