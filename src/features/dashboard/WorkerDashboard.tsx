import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { fetchEnrichedTasks } from "@/lib/project-actions";
import { formatTime } from "@/lib/format";
import {
  CheckCircle2,
  Coffee,
  ClipboardList,
  Camera,
  MessageSquare,
  PlayCircle,
  StopCircle,
  Sandwich,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

type ClockState = "out" | "in" | "tea" | "lunch";

export function WorkerDashboard() {
  const { user } = useAuth();
  const [clock, setClock] = useState<ClockState>("out");
  const [since, setSince] = useState<string | null>(null);

  const { data: myTasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "worker", user?.id],
    queryFn: () => fetchEnrichedTasks({ assignedToProfileId: user!.id }),
    enabled: !!user,
  });

  if (!user) return null;
  const todayDone = myTasks.filter((t) => t.dbStatus === "approved").length;
  const overdue = myTasks.filter((t) => t.status === "Overdue").length;
  const pending = myTasks.filter((t) => !["approved", "archived"].includes(t.dbStatus)).length;
  const submitted = myTasks.filter((t) => t.dbStatus === "submitted_for_review").length;

  const updateClock = (s: ClockState, label: string) => {
    setClock(s);
    setSince(new Date().toISOString());
    toast.success(label);
  };

  return (
    <>
      <div className="mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Good morning</div>
        <h1 className="text-2xl font-semibold tracking-tight">{user.name.split(" ")[0]} 👋</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-ZA", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* CLOCK CARD */}
      <div className="as-card relative overflow-hidden p-5">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background: "linear-gradient(135deg, oklch(0.3 0.08 27 / 0.3), transparent 60%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Attendance
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span
                  className={
                    "relative size-2.5 rounded-full " +
                    (clock === "out" ? "bg-muted-foreground" : "bg-brand")
                  }
                >
                  {clock !== "out" && <span className="pulse-dot" />}
                </span>
                <span className="font-semibold capitalize">
                  {clock === "out" ? "Clocked out" : clock === "in" ? "Clocked in" : `On ${clock}`}
                </span>
              </div>
              {since && (
                <div className="mt-1 text-xs text-muted-foreground">Since {formatTime(since)}</div>
              )}
            </div>
            {clock === "out" ? (
              <Button
                size="lg"
                variant="brand"
                className="h-14 px-6 as-press"
                onClick={() => updateClock("in", "Clocked in — have a great day")}
              >
                <PlayCircle className="size-5" /> Clock in
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="h-14 px-6 as-press border-danger/40 text-danger hover:bg-danger/10"
                onClick={() => updateClock("out", "Clocked out — see you tomorrow")}
              >
                <StopCircle className="size-5" /> Clock out
              </Button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              disabled={clock === "out"}
              onClick={() => updateClock("tea", "Tea break started")}
              className="h-11 as-press"
            >
              <Coffee className="size-4" /> Tea break
            </Button>
            <Button
              variant="outline"
              disabled={clock === "out"}
              onClick={() => updateClock("lunch", "Lunch break started")}
              className="h-11 as-press"
            >
              <Sandwich className="size-4" /> Lunch break
            </Button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="as-card p-3 text-center">
          <div className="text-2xl font-semibold">{myTasks.length}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned</div>
        </div>
        <div className="as-card p-3 text-center">
          <div className="text-2xl font-semibold text-success">{todayDone}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Done today
          </div>
        </div>
        <div className="as-card p-3 text-center">
          <div className={"text-2xl font-semibold " + (overdue ? "text-danger" : "")}>
            {overdue}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue</div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button variant="outline" asChild className="h-16 flex-col gap-1 as-press">
          <Link to="/uploads">
            <Camera className="size-5 text-brand" />
            <span className="text-[11px]">Upload photo</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-16 flex-col gap-1 as-press">
          <Link to="/chat">
            <MessageSquare className="size-5 text-info" />
            <span className="text-[11px]">Project chat</span>
          </Link>
        </Button>
        <Button variant="outline" asChild className="h-16 flex-col gap-1 as-press">
          <Link to="/performance">
            <Trophy className="size-5 text-warning" />
            <span className="text-[11px]">Performance</span>
          </Link>
        </Button>
      </div>

      {/* TASKS */}
      <h2 className="mt-6 mb-2 flex items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          <ClipboardList className="inline size-4 mr-1" /> Today's tasks ({pending})
        </span>
        <Link
          to="/tasks"
          className="text-xs font-medium normal-case tracking-normal text-brand hover:underline"
        >
          See all →
        </Link>
      </h2>
      <div className="space-y-3">
        {myTasks.length === 0 && (
          <div className="as-card p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 size-6 text-success" />
            You're all caught up.
          </div>
        )}
        {myTasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>

      {submitted > 0 && (
        <div className="mt-4 as-card p-4 text-sm text-muted-foreground">
          <CheckCircle2 className="inline size-4 text-info mr-1.5" />
          {submitted} task{submitted === 1 ? "" : "s"} awaiting approval.
        </div>
      )}
      {isLoading && <div className="as-card p-4 text-sm text-muted-foreground">Loading tasks…</div>}
    </>
  );
}
