import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskCard } from "@/components/tasks/TaskCard";
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { fetchEnrichedTasks } from "@/lib/project-actions";
import type { EnrichedTask } from "@/lib/task-mapper";
import type { TaskStatus } from "@/lib/types";

const FILTERS: { label: string; match: (s: TaskStatus) => boolean }[] = [
  { label: "All", match: () => true },
  { label: "Active", match: (s) => ["In Progress", "Assigned", "Not Started"].includes(s) },
  { label: "Overdue", match: (s) => s === "Overdue" },
  { label: "Awaiting review", match: (s) => s === "Submitted for Review" },
  { label: "Blocked", match: (s) => ["Blocked", "Awaiting Materials"].includes(s) },
  { label: "Done", match: (s) => s === "Approved" },
];

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { user, allUsers, hasRole } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [editTask, setEditTask] = useState<EnrichedTask | null>(null);
  const isWorkerLike = user?.role === "worker" || user?.role === "subcontractor";
  const canManage = hasRole("admin", "project_manager", "site_supervisor");

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks", isWorkerLike ? `assigned:${user?.id}` : "all"],
    queryFn: () => fetchEnrichedTasks(isWorkerLike ? { assignedToProfileId: user!.id } : undefined),
    enabled: !!user,
  });

  if (!user) return null;
  const active = FILTERS.find((f) => f.label === filter) ?? FILTERS[0];
  const list: EnrichedTask[] = tasks.filter((t) => active.match(t.status));

  return (
    <>
      <PageHeader
        title={isWorkerLike ? "My tasks" : "Tasks"}
        subtitle={`${list.length} of ${tasks.length} tasks`}
      />
      <div className="mb-4 flex flex-wrap gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={filter === f.label ? "brand" : "outline"}
            size="sm"
            onClick={() => setFilter(f.label)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading tasks…</div>
      ) : error ? (
        <div className="as-card p-6 text-sm text-danger">Error loading tasks.</div>
      ) : list.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">No tasks for this filter.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((t) => (
            <TaskCard key={t.id} task={t} onClick={() => setEditTask(t)} />
          ))}
        </div>
      )}

      {editTask && (
        <EditTaskDialog
          task={editTask}
          assignableUsers={allUsers.filter((u) => ["worker", "subcontractor"].includes(u.role))}
          supervisors={allUsers.filter((u) => u.role === "site_supervisor")}
          canManage={canManage}
          isOwner={editTask.assignedUserId === user.id}
          onClose={() => setEditTask(null)}
          onDone={() => {
            setEditTask(null);
            qc.invalidateQueries({ queryKey: ["tasks"] });
          }}
        />
      )}
    </>
  );
}
