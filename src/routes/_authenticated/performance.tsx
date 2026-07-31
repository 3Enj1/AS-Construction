import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/lib/auth-context";
import { fetchEnrichedTasks, fetchMyRecentHours } from "@/lib/project-actions";
import { relativeFromNow } from "@/lib/format";
import { CheckCircle2, Clock, ListTodo, Timer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const { user } = useAuth();

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["tasks", "mine", user?.id],
    queryFn: () => fetchEnrichedTasks({ assignedToProfileId: user!.id }),
    enabled: !!user,
  });

  const { data: hours = 0, isLoading: hoursLoading } = useQuery({
    queryKey: ["my-recent-hours", user?.id],
    queryFn: () => fetchMyRecentHours(user!.id),
    enabled: !!user,
  });

  if (!user) return null;

  const completed = tasks.filter((t) => t.dbStatus === "approved");
  const active = tasks.filter(
    (t) => !["approved", "rejected", "archived"].includes(t.dbStatus),
  );

  const evaluable = completed.filter((t) => t.dueDate && t.approvedAt);
  const onTime = evaluable.filter(
    (t) => new Date(t.approvedAt!).getTime() <= new Date(t.dueDate! + "T23:59:59").getTime(),
  );
  const onTimeRate = evaluable.length > 0 ? Math.round((onTime.length / evaluable.length) * 100) : null;

  const recentlyCompleted = [...completed]
    .filter((t) => t.approvedAt)
    .sort((a, b) => new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime())
    .slice(0, 5);

  const isLoading = tasksLoading || hoursLoading;

  return (
    <>
      <PageHeader title="My performance" subtitle="Your track record on AS Construction sites." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tasks completed"
          value={isLoading ? "—" : completed.length}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="On-time rate"
          value={isLoading ? "—" : onTimeRate === null ? "—" : `${onTimeRate}%`}
          hint={!isLoading && onTimeRate === null ? "No completed tasks with due dates yet" : undefined}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label="Active tasks"
          value={isLoading ? "—" : active.length}
          icon={ListTodo}
          tone="brand"
        />
        <StatCard
          label="Hours — last 7 days"
          value={isLoading ? "—" : `${hours}h`}
          icon={Timer}
          tone="warning"
        />
      </div>

      <div className="mt-8 as-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recently completed
        </h3>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : recentlyCompleted.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No approved tasks yet — completed work will show up here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {recentlyCompleted.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                  <span className="truncate">{t.title}</span>
                  {t.projectCode && (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {t.projectCode}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeFromNow(t.approvedAt!)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
