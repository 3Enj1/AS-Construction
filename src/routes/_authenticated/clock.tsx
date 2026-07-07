import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import { Coffee, PlayCircle, Sandwich, StopCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clock")({
  component: ClockPage,
});

function ClockPage() {
  const [state, setState] = useState<"out" | "in" | "tea" | "lunch">("out");
  const [since, setSince] = useState<string | null>(null);
  const set = (s: typeof state, msg: string) => {
    setState(s);
    setSince(new Date().toISOString());
    toast.success(msg);
  };

  return (
    <>
      <PageHeader title="Clock In / Attendance" subtitle="Track your day on site." />
      <div className="as-card relative overflow-hidden p-6">
        <div className="text-center">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Current status</div>
          <div className="mt-2 text-3xl font-semibold capitalize">
            {state === "out" ? "Clocked out" : state === "in" ? "Clocked in" : `On ${state}`}
          </div>
          {since && (
            <div className="mt-1 text-sm text-muted-foreground">Since {formatTime(since)}</div>
          )}
        </div>
        <div className="mx-auto mt-6 grid max-w-md gap-3">
          {state === "out" ? (
            <Button className="h-16 bg-brand text-brand-foreground text-base hover:bg-brand/90 as-press" onClick={() => set("in", "Clocked in")}>
              <PlayCircle className="size-6" /> Clock in
            </Button>
          ) : (
            <Button variant="outline" className="h-16 border-danger/40 text-danger text-base hover:bg-danger/10 as-press" onClick={() => set("out", "Clocked out")}>
              <StopCircle className="size-6" /> Clock out
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" disabled={state === "out"} className="h-14 as-press" onClick={() => set("tea", "Tea break")}>
              <Coffee className="size-4" /> Tea
            </Button>
            <Button variant="outline" disabled={state === "out"} className="h-14 as-press" onClick={() => set("lunch", "Lunch break")}>
              <Sandwich className="size-4" /> Lunch
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
