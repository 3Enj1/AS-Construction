import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { useAuth } from "@/lib/auth-context";
import { DEMO_TASKS } from "@/lib/demo-data";
import { CheckCircle2, Clock, Star, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/performance")({
  component: PerformancePage,
});

function PerformancePage() {
  const { user } = useAuth();
  if (!user) return null;
  const my = DEMO_TASKS.filter((t) => t.assignedTo.includes(user.id));
  const done = my.filter((t) => t.status === "Approved").length;
  const ontime = 92;

  return (
    <>
      <PageHeader title="My performance" subtitle="Your track record on AS Construction sites." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tasks completed" value={done + 14} icon={CheckCircle2} tone="success" />
        <StatCard label="On-time rate" value={`${ontime}%`} icon={Clock} tone="info" />
        <StatCard label="Hours this week" value={"38h"} icon={Trophy} tone="brand" />
        <StatCard label="Rating" value="4.8" hint="of 5.0" icon={Star} tone="warning" />
      </div>

      <div className="mt-8 as-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent recognitions</h3>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2"><Trophy className="size-4 text-warning" /> Top performer — March 2026</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="size-4 text-success" /> 30 consecutive days on time</li>
          <li className="flex items-center gap-2"><Star className="size-4 text-info" /> Client commendation — Constantia Residence</li>
        </ul>
      </div>
    </>
  );
}
