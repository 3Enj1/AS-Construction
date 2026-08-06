import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { PRIORITY_UI_TO_DB, type EnrichedTask } from "@/lib/task-mapper";
import { TASK_CATEGORIES, taskVisual } from "@/lib/task-visuals";
import { fetchMaterials, getSignedPhotoUrls, logMaterialUsage, uploadTaskPhoto } from "@/lib/project-actions";
import { toast } from "sonner";
import { Camera, ImageIcon, X } from "lucide-react";

export function EditTaskDialog({
  task,
  assignableUsers,
  supervisors,
  canManage,
  isOwner,
  onClose,
  onDone,
}: {
  task: EnrichedTask;
  assignableUsers: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  canManage: boolean;
  isOwner: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState(PRIORITY_UI_TO_DB[task.priority]);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [status, setStatus] = useState(task.dbStatus);
  const [assignedUserId, setAssignedUserId] = useState(task.assignedUserId ?? "unassigned");
  const [supervisorId, setSupervisorId] = useState(task.supervisorId ?? "unassigned");
  const [clientVisible, setClientVisible] = useState(task.clientVisible);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: taskPhotos = [] } = useQuery({
    queryKey: ["task-photos", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_photos")
        .select("id,file_url,created_at")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: taskPhotoUrls = new Map<string, string>() } = useQuery({
    queryKey: ["task-photo-urls", taskPhotos.map((p) => p.file_url)],
    queryFn: () => getSignedPhotoUrls(taskPhotos.map((p) => p.file_url)),
    enabled: taskPhotos.length > 0,
  });

  const save = useMutation({
    mutationFn: async () => {
      const prevAssignee = task.assignedUserId;
      const updates: TablesUpdate<"tasks"> = {};
      if (canManage) {
        updates.task_title = title.trim();
        updates.description = description || null;
        updates.category = category;
        updates.priority = priority;
        updates.due_date = dueDate || null;
        updates.assigned_user_id = assignedUserId === "unassigned" ? null : assignedUserId;
        updates.assigned_supervisor_id = supervisorId === "unassigned" ? null : supervisorId;
        updates.client_visible = clientVisible;
      }
      updates.status = status;
      const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
      if (error) throw error;

      if (canManage && updates.assigned_user_id && updates.assigned_user_id !== prevAssignee) {
        await supabase.from("notifications").insert({
          for_user_id: updates.assigned_user_id as string,
          kind: "info",
          title: "New task assigned",
          body: `You have been assigned: ${title}`,
          link_url: `/tasks`,
        });
      }
    },
    onSuccess: () => {
      toast.success("Task updated");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (photo) {
        await uploadTaskPhoto({
          projectId: task.projectId,
          taskId: task.id,
          file: photo,
          category: "progress",
          note: note || null,
        });
      }
      const { data: u } = await supabase.auth.getUser();
      const { data: me } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", u.user!.id)
        .maybeSingle();
      const { error } = await supabase.from("task_updates").insert({
        task_id: task.id,
        project_id: task.projectId,
        user_id: me!.id,
        update_type: "note",
        note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Update added");
      setNote("");
      setPhoto(null);
      qc.invalidateQueries({ queryKey: ["task-photos", task.id] });
      qc.invalidateQueries({ queryKey: ["task-updates", task.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (photo) {
        await uploadTaskPhoto({
          projectId: task.projectId,
          taskId: task.id,
          file: photo,
          category: "completion",
          note: note || null,
        });
      }
      const { data: u } = await supabase.auth.getUser();
      const { data: me } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", u.user!.id)
        .maybeSingle();
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "submitted_for_review",
          submitted_for_review_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw error;
      await supabase.from("task_updates").insert({
        task_id: task.id,
        project_id: task.projectId,
        user_id: me!.id,
        update_type: "submitted_for_review",
        note: note || null,
      });
      // best-effort notifications
      const { data: proj } = await supabase
        .from("projects")
        .select("assigned_project_manager_id,assigned_site_supervisor_id")
        .eq("id", task.projectId)
        .maybeSingle();
      const recipients = [
        proj?.assigned_project_manager_id,
        proj?.assigned_site_supervisor_id,
        task.supervisorId,
      ].filter(Boolean) as string[];
      if (recipients.length) {
        await supabase.from("notifications").insert(
          recipients.map((rid) => ({
            for_user_id: rid,
            kind: "info",
            title: "Task submitted for review",
            body: `${task.title}`,
            link_url: "/approvals",
          })),
        );
      } else {
        await supabase.from("notifications").insert({
          for_role: "admin",
          kind: "info",
          title: "Task submitted for review",
          body: `${task.title}`,
          link_url: "/approvals",
        });
      }
    },
    onSuccess: () => {
      toast.success("Submitted for review");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [usageMaterialId, setUsageMaterialId] = useState("");
  const [usageQty, setUsageQty] = useState("");
  const { data: materials = [] } = useQuery({
    queryKey: ["materials"],
    queryFn: fetchMaterials,
  });
  const logUsage = useMutation({
    mutationFn: () =>
      logMaterialUsage({
        materialId: usageMaterialId,
        projectId: task.projectId,
        taskId: task.id,
        quantity: Number(usageQty),
      }),
    onSuccess: () => {
      toast.success("Usage logged");
      setUsageMaterialId("");
      setUsageQty("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const canLogUsage =
    (canManage || isOwner) &&
    ["assigned", "in_progress", "awaiting_materials"].includes(task.dbStatus);

  const { data: updates = [] } = useQuery({
    queryKey: ["task-updates", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_updates")
        .select("id,update_type,note,created_at,user_id")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{canManage ? "Edit task" : "Task"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canManage} />
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={!canManage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {taskVisual(c).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as typeof status)}
                disabled={!canManage && !isOwner}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not started</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="awaiting_materials">Awaiting materials</SelectItem>
                  {canManage && <SelectItem value="approved">Approved</SelectItem>}
                  {canManage && <SelectItem value="rejected">Rejected</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as typeof priority)}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={!canManage}
              />
            </div>
          </div>
          {canManage && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Assigned to</Label>
                <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {assignableUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Supervisor</Label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {supervisors.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox
                  checked={clientVisible}
                  onCheckedChange={(c) => setClientVisible(c === true)}
                />
                Visible to client
              </label>
            </div>
          )}

          {(canManage || isOwner) && (
            <div className="grid gap-1.5 border-t border-border pt-3">
              <Label>Add progress note</Label>
              <Textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's the latest?"
              />
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              />
              {photo ? (
                <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                  <span className="truncate">{photo.name}</span>
                  <button type="button" onClick={() => setPhoto(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Camera className="size-4" /> Add photo (optional)
                </Button>
              )}
              {taskPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {taskPhotos.map((p) => {
                    const src = taskPhotoUrls.get(p.file_url);
                    return (
                      <div
                        key={p.id}
                        className="grid size-12 place-items-center overflow-hidden rounded-md bg-surface-2"
                      >
                        {src ? (
                          <img src={src} alt="Task photo" className="size-full object-cover" />
                        ) : (
                          <ImageIcon className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(!note.trim() && !photo) || addNote.isPending}
                  onClick={() => addNote.mutate()}
                >
                  {addNote.isPending ? "Adding…" : "Add note"}
                </Button>
                {isOwner &&
                  task.dbStatus !== "submitted_for_review" &&
                  task.dbStatus !== "approved" && (
                    <Button
                      size="sm"
                      variant="brand"
                      disabled={submitReview.isPending}
                      onClick={() => submitReview.mutate()}
                    >
                      {submitReview.isPending ? "Submitting…" : "Submit for review"}
                    </Button>
                  )}
              </div>
            </div>
          )}

          {canLogUsage && (
            <div className="grid gap-1.5 border-t border-border pt-3">
              <Label>Log material usage</Label>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <Select value={usageMaterialId} onValueChange={setUsageMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Qty"
                  value={usageQty}
                  onChange={(e) => setUsageQty(e.target.value)}
                  className="sm:w-24"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!usageMaterialId || !Number(usageQty) || logUsage.isPending}
                  onClick={() => logUsage.mutate()}
                >
                  {logUsage.isPending ? "Logging…" : "Log"}
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              History
            </div>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {updates.length === 0 && (
                <div className="text-xs text-muted-foreground">No updates yet.</div>
              )}
              {updates.map((u) => (
                <div key={u.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="font-medium">{u.update_type}</div>
                  {u.note && <div className="mt-0.5 text-muted-foreground">{u.note}</div>}
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(u.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {canManage && (
            <Button
              variant="outline"
              className="border-danger/40 text-danger hover:bg-danger/10"
              onClick={async () => {
                const { error } = await supabase
                  .from("tasks")
                  .update({
                    is_archived: true,
                    archived_at: new Date().toISOString(),
                  })
                  .eq("id", task.id);
                if (error) toast.error(error.message);
                else {
                  toast.success("Task archived");
                  onDone();
                }
              }}
            >
              Archive
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending} variant="brand">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
