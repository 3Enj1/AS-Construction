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
import { archiveProject, fetchArchivedProjects, restoreProject } from "@/lib/project-actions";
import { relativeFromNow } from "@/lib/format";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

/** Everything that lists projects or their tasks needs refreshing after a remove/restore. */
function refreshProjectViews(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ["projects", "projects-active-count", "tasks", "archived-projects"])
    qc.invalidateQueries({ queryKey: [key] });
}

/** "Are you sure?" before removing (archiving) a project. */
export function RemoveProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => archiveProject(project!.id),
    onSuccess: () => {
      toast.success("Project removed");
      onOpenChange(false);
      refreshProjectViews(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this project?</AlertDialogTitle>
          <AlertDialogDescription>
            "{project?.name}" and its tasks will be removed from the app for everyone. Its tasks,
            diary, chat and photos are kept, and you can restore it from "Removed projects".
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <Button
            className="bg-danger text-danger-foreground hover:bg-danger/90"
            disabled={!project || remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Removing…" : "Remove project"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** List of removed projects, each with a Restore button. */
export function RemovedProjectsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: removed = [], isLoading } = useQuery({
    queryKey: ["archived-projects"],
    queryFn: fetchArchivedProjects,
    enabled: open,
  });
  const restore = useMutation({
    mutationFn: restoreProject,
    onSuccess: () => {
      toast.success("Project restored");
      refreshProjectViews(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Removed projects</DialogTitle>
          <DialogDescription>Restore a project to bring it and its tasks back.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : removed.length === 0 ? (
          <div className="text-sm text-muted-foreground">No removed projects.</div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {removed.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.name}</div>
                  {p.archivedAt && (
                    <div className="text-[11px] text-muted-foreground">
                      Removed {relativeFromNow(p.archivedAt)}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(p.id)}
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
