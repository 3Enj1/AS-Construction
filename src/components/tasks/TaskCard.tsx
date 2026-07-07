import { StatusPill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/user-avatar";
import { formatDate } from "@/lib/format";
import type { EnrichedTask } from "@/lib/task-mapper";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CalendarClock, Flag, HardHat } from "lucide-react";

const PRIO_TONE: Record<Task["priority"], string> = {
  Low: "text-muted-foreground",
  Medium: "text-info",
  High: "text-warning",
  Critical: "text-danger",
};

export function TaskCard({
  task,
  onClick,
  compact,
}: {
  task: EnrichedTask;
  onClick?: () => void;
  compact?: boolean;
}) {
  const overdue = task.status === "Overdue";
  return (
    <button
      onClick={onClick}
      className={cn(
        "as-card as-press group block w-full text-left p-4 hover:border-brand/40",
        overdue && "border-danger/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {task.projectCode && <span className="font-mono">{task.projectCode}</span>}
            {task.projectName && <><span>·</span><span className="truncate">{task.projectName}</span></>}
            {task.phaseName && <><span>·</span><span className="truncate">{task.phaseName}</span></>}
          </div>
          <h3 className="mt-1 font-medium leading-snug text-foreground">{task.title}</h3>
          {!compact && task.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
          )}
        </div>
        <StatusPill status={task.status} kind="task" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-muted-foreground">
          {task.dueDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" /> {formatDate(task.dueDate)}
            </span>
          )}
          <span className={cn("inline-flex items-center gap-1 font-medium", PRIO_TONE[task.priority])}>
            <Flag className="size-3.5" /> {task.priority}
          </span>
          {task.supervisor && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <HardHat className="size-3.5" /> {task.supervisor.name.split(" ")[0]}
            </span>
          )}
        </div>
        <div className="flex -space-x-2">
          {task.assignees.slice(0, 3).map((u) => (
            <UserAvatar key={u.id} user={u} size={24} className="ring-2 ring-card" />
          ))}
        </div>
      </div>
    </button>
  );
}
