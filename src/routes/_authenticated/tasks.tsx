import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchEnrichedTasks, uploadTaskPhoto } from "@/lib/project-actions";
import type { DbTaskStatus, EnrichedTask } from "@/lib/task-mapper";
import type { TaskStatus } from "@/lib/types";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

const SUBMITTABLE: ReadonlySet<DbTaskStatus> = new Set([
  "not_started",
  "assigned",
  "in_progress",
  "blocked",
  "awaiting_materials",
  "rejected",
]);

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("All");
  const [submitting, setSubmitting] = useState<EnrichedTask | null>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isWorkerLike = user?.role === "worker" || user?.role === "subcontractor";

  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tasks", isWorkerLike ? `assigned:${user?.id}` : "all"],
    queryFn: () => fetchEnrichedTasks(isWorkerLike ? { assignedToProfileId: user!.id } : undefined),
    enabled: !!user,
  });

  const submitForReview = useMutation({
    mutationFn: async (t: EnrichedTask) => {
      if (file) {
        await uploadTaskPhoto({
          projectId: t.projectId,
          taskId: t.id,
          file,
          category: "completion",
          note: note || null,
        });
      }
      const { error } = await supabase
        .from("tasks")
        .update({ status: "submitted_for_review", submitted_for_review_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) throw error;
      if (t.supervisorId) {
        await supabase.from("notifications").insert({
          title: "Task submitted for review",
          body: `"${t.title}" is ready for review.`,
          kind: "info",
          for_user_id: t.supervisorId,
        });
      }
    },
    onSuccess: () => {
      toast.success("Submitted for review");
      setSubmitting(null);
      setNote("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not submit task"),
  });

  const closeDialog = () => {
    setSubmitting(null);
    setNote("");
    setFile(null);
  };

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
            <div key={t.id} className="space-y-2">
              <TaskCard task={t} />
              {t.assignedUserId === user.id && SUBMITTABLE.has(t.dbStatus) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setSubmitting(t)}
                >
                  <Camera className="size-4" /> Submit for review
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!submitting} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit for review</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{submitting?.title}</p>
          <Textarea
            rows={3}
            placeholder="Optional note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Camera className="size-4" /> Add completion photo (optional)
            </Button>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              variant="brand"
              disabled={submitForReview.isPending}
              onClick={() => submitting && submitForReview.mutate(submitting)}
            >
              {submitForReview.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
