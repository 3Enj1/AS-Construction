import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveTask, fetchArchivedTasks, restoreTask } from "@/lib/project-actions";
import { relativeFromNow } from "@/lib/format";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

/** "Are you sure?" before removing (archiving) a task. */
export function RemoveTaskDialog({
  task,
  open,
  onOpenChange,
  onRemoved,
}: {
  task: { id: string; title: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoved: () => void;
}) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => archiveTask(task!.id),
    onSuccess: () => {
      toast.success("Task removed");
      qc.invalidateQueries({ queryKey: ["archived-tasks"] });
      onOpenChange(false);
      onRemoved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this task?</AlertDialogTitle>
          <AlertDialogDescription>
            "{task?.title}" will be removed from the project. Its diary entries, photos and history
            are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button
            className="bg-danger text-danger-foreground hover:bg-danger/90"
            disabled={!task || remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Removing…" : "Remove task"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** List of a project's removed tasks, each with a Restore button. */
export function RemovedTasksDialog({
  projectId,
  open,
  onOpenChange,
  onRestored,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}) {
  const qc = useQueryClient();
  const { data: removed = [], isLoading } = useQuery({
    queryKey: ["archived-tasks", projectId],
    queryFn: () => fetchArchivedTasks(projectId),
    enabled: open,
  });

  const restore = useMutation({
    mutationFn: restoreTask,
    onSuccess: () => {
      toast.success("Task restored");
      qc.invalidateQueries({ queryKey: ["archived-tasks", projectId] });
      onRestored();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Removed tasks</DialogTitle>
          <DialogDescription>Restore a task to put it back on the project.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : removed.length === 0 ? (
          <div className="text-sm text-muted-foreground">No removed tasks.</div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {removed.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{t.title}</div>
                  {t.archivedAt && (
                    <div className="text-[11px] text-muted-foreground">
                      Removed {relativeFromNow(t.archivedAt)}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(t.id)}
                >
                  <RotateCcw className="size-3.5" /> Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
