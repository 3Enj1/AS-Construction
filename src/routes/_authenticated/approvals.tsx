import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchEnrichedTasks } from "@/lib/project-actions";
import { useAuth } from "@/lib/auth-context";
import type { EnrichedTask } from "@/lib/task-mapper";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [rejecting, setRejecting] = useState<EnrichedTask | null>(null);
  const [reason, setReason] = useState("");
  useNavigate();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "approvals"],
    queryFn: () => fetchEnrichedTasks(),
  });
  const pending = tasks.filter((t) => t.dbStatus === "submitted_for_review");

  const approve = useMutation({
    mutationFn: async (t: EnrichedTask) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "approved",
          approved_by: user?.id ?? null,
          approved_at: now,
          completed_at: now,
        })
        .eq("id", t.id);
      if (error) throw error;
      if (t.assignedUserId) {
        await supabase.from("notifications").insert({
          title: "Task approved",
          body: `"${t.title}" was approved.`,
          kind: "success",
          for_user_id: t.assignedUserId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Task approved");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ t, reason }: { t: EnrichedTask; reason: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "rejected", rejection_reason: reason })
        .eq("id", t.id);
      if (error) throw error;
      if (t.assignedUserId) {
        await supabase.from("notifications").insert({
          title: "Task needs rework",
          body: reason || `"${t.title}" was rejected.`,
          kind: "warning",
          for_user_id: t.assignedUserId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Task sent back for rework");
      setRejecting(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Task Approvals" subtitle="Review and approve completed work." />
      <div className="as-card divide-y divide-border">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nothing waiting for approval.</div>
        ) : (
          pending.map((t) => {
            const submitter = t.assignees[0];
            return (
              <div key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono text-muted-foreground">{t.projectCode}</div>
                  <div className="mt-0.5 font-medium">{t.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {submitter && <UserAvatar user={submitter} size={20} />}
                    {submitter && <>Submitted by <span className="text-foreground">{submitter.name}</span></>}
                  </div>
                </div>
                <StatusPill status={t.status} kind="task" />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-danger/40 text-danger hover:bg-danger/10"
                    onClick={() => setRejecting(t)}
                    disabled={reject.isPending}
                  >
                    <XCircle className="size-4" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-success text-success-foreground hover:bg-success/90"
                    onClick={() => approve.mutate(t)}
                    disabled={approve.isPending}
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{rejecting?.title}</p>
          <Textarea
            rows={4}
            placeholder="Reason for rejection (required)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejecting(null); setReason(""); }}>Cancel</Button>
            <Button
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => rejecting && reject.mutate({ t: rejecting, reason: reason.trim() })}
            >
              {reject.isPending ? "Sending…" : "Send for rework"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
