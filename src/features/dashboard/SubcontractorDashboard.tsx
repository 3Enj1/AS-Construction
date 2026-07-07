import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskCard } from "@/components/tasks/TaskCard";
import { useAuth } from "@/lib/auth-context";
import { fetchEnrichedTasks } from "@/lib/project-actions";

export function SubcontractorDashboard() {
  const { user } = useAuth();
  const { data: mine = [], isLoading } = useQuery({
    queryKey: ["tasks", "sub", user?.id],
    queryFn: () => fetchEnrichedTasks({ assignedToProfileId: user!.id }),
    enabled: !!user,
  });
  if (!user) return null;
  return (
    <>
      <PageHeader title="Assigned work" subtitle="Tasks AS Construction has assigned to your team." />
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading tasks…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {mine.map((t) => <TaskCard key={t.id} task={t} />)}
          {mine.length === 0 && (
            <div className="as-card p-6 text-sm text-muted-foreground">No assigned work right now.</div>
          )}
        </div>
      )}
    </>
  );
}
