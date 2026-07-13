import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTime } from "@/lib/format";
import {
  clockIn,
  clockOut,
  fetchMyOpenAttendance,
  fetchProjectsMini,
  startBreak,
} from "@/lib/project-actions";
import { Coffee, PlayCircle, Sandwich, StopCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clock")({
  component: ClockPage,
});

function ClockPage() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState<string>("");

  const { data: current, isLoading } = useQuery({
    queryKey: ["my-attendance"],
    queryFn: fetchMyOpenAttendance,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-attendance"] });

  const clockInMut = useMutation({
    mutationFn: () => clockIn(projectId || null),
    onSuccess: () => {
      toast.success("Clocked in");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not clock in"),
  });

  const breakMut = useMutation({
    mutationFn: (label: "Tea" | "Lunch") => {
      if (!current) throw new Error("Not clocked in");
      return startBreak(current).then(() => label);
    },
    onSuccess: (label) => {
      toast.success(`${label} break`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not start break"),
  });

  const clockOutMut = useMutation({
    mutationFn: () => {
      if (!current) throw new Error("Not clocked in");
      return clockOut(current);
    },
    onSuccess: () => {
      toast.success("Clocked out");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not clock out"),
  });

  const state: "out" | "in" | "break" = !current
    ? "out"
    : current.status === "On Break"
      ? "break"
      : "in";
  const since = current
    ? current.status === "On Break"
      ? (current.breakStartedAt ?? current.clockIn)
      : current.clockIn
    : null;
  const busy = clockInMut.isPending || breakMut.isPending || clockOutMut.isPending;

  return (
    <>
      <PageHeader title="Clock In / Attendance" subtitle="Track your day on site." />
      <div className="as-card relative overflow-hidden p-6">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Current status
          </div>
          <div className="mt-2 text-3xl font-semibold capitalize">
            {isLoading
              ? "…"
              : state === "out"
                ? "Clocked out"
                : state === "in"
                  ? "Clocked in"
                  : "On break"}
          </div>
          {since && (
            <div className="mt-1 text-sm text-muted-foreground">Since {formatTime(since)}</div>
          )}
        </div>
        <div className="mx-auto mt-6 grid max-w-md gap-3">
          {state === "out" && (
            <div className="grid gap-1.5 text-left">
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {state === "out" ? (
            <Button
              variant="brand"
              className="h-16 text-base as-press"
              disabled={busy || isLoading}
              onClick={() => clockInMut.mutate()}
            >
              <PlayCircle className="size-6" /> Clock in
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-16 border-danger/40 text-danger text-base hover:bg-danger/10 as-press"
              disabled={busy}
              onClick={() => clockOutMut.mutate()}
            >
              <StopCircle className="size-6" /> Clock out
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={state === "out" || busy}
              className="h-14 as-press"
              onClick={() => breakMut.mutate("Tea")}
            >
              <Coffee className="size-4" /> Tea
            </Button>
            <Button
              variant="outline"
              disabled={state === "out" || busy}
              className="h-14 as-press"
              onClick={() => breakMut.mutate("Lunch")}
            >
              <Sandwich className="size-4" /> Lunch
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
