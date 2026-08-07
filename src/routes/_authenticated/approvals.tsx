import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Pill, StatusPill } from "@/components/ui/status-pill";
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
import {
  approveTaskSuggestion,
  deleteTaskSuggestion,
  fetchEnrichedTasks,
  fetchTaskSuggestions,
  getSignedPhotoUrls,
  rejectTaskSuggestion,
  type TaskSuggestion,
} from "@/lib/project-actions";
import { useAuth } from "@/lib/auth-context";
import type { EnrichedTask } from "@/lib/task-mapper";
import { CheckCircle2, ImageIcon, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ApprovalsPage() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [rejecting, setRejecting] = useState<EnrichedTask | null>(null);
  const [reason, setReason] = useState("");
  const [rejectingSuggestion, setRejectingSuggestion] = useState<TaskSuggestion | null>(null);
  const [suggestionReason, setSuggestionReason] = useState("");
  useNavigate();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "approvals"],
    queryFn: () => fetchEnrichedTasks(),
  });
  const pending = tasks.filter((t) => t.dbStatus === "submitted_for_review");
  const pendingIds = pending.map((t) => t.id);

  const { data: photos = [] } = useQuery({
    queryKey: ["approval-photos", pendingIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_photos")
        .select("task_id,file_url,created_at")
        .in("task_id", pendingIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: pendingIds.length > 0,
  });
  const latestPhotoByTask = new Map<string, string>();
  for (const p of photos)
    if (!latestPhotoByTask.has(p.task_id)) latestPhotoByTask.set(p.task_id, p.file_url);

  const { data: photoUrls = new Map<string, string>() } = useQuery({
    queryKey: ["approval-photo-urls", photos.map((p) => p.file_url)],
    queryFn: () => getSignedPhotoUrls(photos.map((p) => p.file_url)),
    enabled: photos.length > 0,
  });

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

  const { data: suggestions = [] } = useQuery({
    queryKey: ["task-suggestions"],
    queryFn: fetchTaskSuggestions,
    enabled: isAdmin,
  });
  const suggestionPhotoPaths = suggestions.map((s) => s.photoUrl).filter((p): p is string => !!p);
  const { data: suggestionPhotoUrls = new Map<string, string>() } = useQuery({
    queryKey: ["task-suggestion-photo-urls", suggestionPhotoPaths],
    queryFn: () => getSignedPhotoUrls(suggestionPhotoPaths),
    enabled: isAdmin && suggestionPhotoPaths.length > 0,
  });

  const invalidateSuggestions = () => qc.invalidateQueries({ queryKey: ["task-suggestions"] });

  const approveSuggestion = useMutation({
    mutationFn: (s: TaskSuggestion) => approveTaskSuggestion(s),
    onSuccess: () => {
      toast.success("Suggestion approved — task created");
      invalidateSuggestions();
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not approve suggestion"),
  });

  const rejectSuggestion = useMutation({
    mutationFn: ({ s, reason }: { s: TaskSuggestion; reason: string }) =>
      rejectTaskSuggestion(s, reason),
    onSuccess: () => {
      toast.success("Suggestion rejected");
      setRejectingSuggestion(null);
      setSuggestionReason("");
      invalidateSuggestions();
    },
    onError: (e: Error) => toast.error(e.message || "Could not reject suggestion"),
  });

  const removeSuggestion = useMutation({
    mutationFn: (id: string) => deleteTaskSuggestion(id),
    onSuccess: () => {
      toast.success("Suggestion deleted");
      invalidateSuggestions();
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete suggestion"),
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
            const photoPath = latestPhotoByTask.get(t.id);
            const photoSrc = photoPath ? photoUrls.get(photoPath) : undefined;
            return (
              <div key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                {photoPath && (
                  <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
                    {photoSrc ? (
                      <img
                        src={photoSrc}
                        alt="Completion photo"
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-5 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono text-muted-foreground">{t.projectCode}</div>
                  <div className="mt-0.5 font-medium">{t.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {submitter && <UserAvatar user={submitter} size={20} />}
                    {submitter && (
                      <>
                        Submitted by <span className="text-foreground">{submitter.name}</span>
                      </>
                    )}
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

      {isAdmin && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Task suggestions
            {suggestions.length > 0 && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] normal-case tracking-normal text-foreground">
                {suggestions.length}
              </span>
            )}
          </h2>
          <div className="as-card divide-y divide-border">
            {suggestions.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No task suggestions right now.
              </div>
            ) : (
              suggestions.map((s) => {
                const photoSrc = s.photoUrl ? suggestionPhotoUrls.get(s.photoUrl) : undefined;
                const isPending = s.status === "pending";
                return (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {s.photoUrl && (
                        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
                          {photoSrc ? (
                            <img src={photoSrc} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageIcon className="size-5 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium">{s.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.projectName} · suggested by {s.suggestedByName ?? "someone"}
                        </div>
                        {s.description && (
                          <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                            {s.description}
                          </div>
                        )}
                        {!isPending && s.reviewComment && (
                          <div className="mt-0.5 text-xs text-muted-foreground italic">
                            "{s.reviewComment}"
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.urgency === "urgent" && <Pill tone="danger">Urgent</Pill>}
                      <StatusPill status={capitalize(s.status)} kind="tone" />
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-danger/40 text-danger hover:bg-danger/10"
                            disabled={rejectSuggestion.isPending}
                            onClick={() => setRejectingSuggestion(s)}
                          >
                            <XCircle className="size-4" /> Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-success text-success-foreground hover:bg-success/90"
                            disabled={approveSuggestion.isPending}
                            onClick={() => approveSuggestion.mutate(s)}
                          >
                            <CheckCircle2 className="size-4" /> Approve
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground hover:text-danger"
                          disabled={removeSuggestion.isPending}
                          onClick={() => removeSuggestion.mutate(s.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <Dialog
        open={!!rejecting}
        onOpenChange={(o) => {
          if (!o) {
            setRejecting(null);
            setReason("");
          }
        }}
      >
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
            <Button
              variant="outline"
              onClick={() => {
                setRejecting(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
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

      <Dialog
        open={!!rejectingSuggestion}
        onOpenChange={(o) => {
          if (!o) {
            setRejectingSuggestion(null);
            setSuggestionReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject suggestion</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{rejectingSuggestion?.title}</p>
          <Textarea
            rows={4}
            placeholder="Reason (optional)…"
            value={suggestionReason}
            onChange={(e) => setSuggestionReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingSuggestion(null);
                setSuggestionReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-danger text-danger-foreground hover:bg-danger/90"
              disabled={rejectSuggestion.isPending}
              onClick={() =>
                rejectingSuggestion &&
                rejectSuggestion.mutate({ s: rejectingSuggestion, reason: suggestionReason.trim() })
              }
            >
              {rejectSuggestion.isPending ? "Sending…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
