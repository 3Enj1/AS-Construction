import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTemplate,
  updateTemplate,
  type TemplateFull,
  type TemplateInput,
} from "@/lib/project-actions";
import { TEMPLATE_CATEGORIES, templateVisual } from "@/lib/template-visuals";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type Priority = "low" | "medium" | "high" | "urgent";
type BuilderTask = { title: string; description: string; priority: Priority; days: string };
type BuilderPhase = { name: string; description: string; tasks: BuilderTask[] };

function emptyTask(): BuilderTask {
  return { title: "", description: "", priority: "medium", days: "3" };
}
function emptyPhase(): BuilderPhase {
  return { name: "", description: "", tasks: [emptyTask()] };
}

export function TemplateBuilderDialog({
  template,
  onDone,
}: {
  template?: TemplateFull;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [category, setCategory] = useState(template?.category ?? TEMPLATE_CATEGORIES[0]);
  const [phases, setPhases] = useState<BuilderPhase[]>(
    template
      ? template.phases.map((p) => ({
          name: p.name,
          description: p.description ?? "",
          tasks: p.tasks.map((t) => ({
            title: t.title,
            description: t.description ?? "",
            priority: t.priority as Priority,
            days: String(t.days),
          })),
        }))
      : [emptyPhase()],
  );

  const updatePhase = (i: number, patch: Partial<BuilderPhase>) =>
    setPhases((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const updateTask = (pi: number, ti: number, patch: Partial<BuilderTask>) =>
    setPhases((prev) =>
      prev.map((p, idx) =>
        idx === pi
          ? { ...p, tasks: p.tasks.map((t, tidx) => (tidx === ti ? { ...t, ...patch } : t)) }
          : p,
      ),
    );

  const save = useMutation({
    mutationFn: async () => {
      const input: TemplateInput = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        phases: phases
          .filter((p) => p.name.trim())
          .map((p) => ({
            name: p.name.trim(),
            description: p.description.trim() || null,
            tasks: p.tasks
              .filter((t) => t.title.trim())
              .map((t) => ({
                title: t.title.trim(),
                description: t.description.trim() || null,
                priority: t.priority,
                days: Math.max(1, Number(t.days) || 1),
              })),
          }))
          .filter((p) => p.tasks.length > 0),
      };
      if (template) await updateTemplate(template.id, input);
      else await createTemplate(input);
    },
    onSuccess: () => {
      toast.success(template ? "Template updated" : "Template created");
      qc.invalidateQueries({ queryKey: ["project-templates"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not save template"),
  });

  const valid = !!(
    name.trim() && phases.some((p) => p.name.trim() && p.tasks.some((t) => t.title.trim()))
  );

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tpl-name">Template name</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Loft Conversion"
          />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {templateVisual(c).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-desc">Description</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Label>Phases</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPhases((p) => [...p, emptyPhase()])}
          >
            <Plus className="size-3.5" /> Add phase
          </Button>
        </div>

        {phases.map((phase, pi) => (
          <div key={pi} className="rounded-md border border-border bg-surface-2 p-3">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
                <Input
                  placeholder={`Phase ${pi + 1} name`}
                  value={phase.name}
                  onChange={(e) => updatePhase(pi, { name: e.target.value })}
                />
                <Input
                  placeholder="Phase description (optional)"
                  value={phase.description}
                  onChange={(e) => updatePhase(pi, { description: e.target.value })}
                />
              </div>
              {phases.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-danger"
                  onClick={() => setPhases((p) => p.filter((_, idx) => idx !== pi))}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>

            <div className="mt-2 space-y-2">
              {phase.tasks.map((task, ti) => (
                <div
                  key={ti}
                  className="grid gap-1.5 sm:grid-cols-[1fr_120px_90px_auto] sm:items-center sm:gap-2"
                >
                  <Input
                    placeholder="Task title"
                    value={task.title}
                    onChange={(e) => updateTask(pi, ti, { title: e.target.value })}
                    className="h-9"
                  />
                  <Select
                    value={task.priority}
                    onValueChange={(v) => updateTask(pi, ti, { priority: v as Priority })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Days"
                    value={task.days}
                    onChange={(e) => updateTask(pi, ti, { days: e.target.value })}
                    className="h-9"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 text-muted-foreground"
                    onClick={() =>
                      setPhases((prev) =>
                        prev.map((p, idx) =>
                          idx === pi
                            ? { ...p, tasks: p.tasks.filter((_, tidx) => tidx !== ti) }
                            : p,
                        ),
                      )
                    }
                    disabled={phase.tasks.length <= 1}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="text-brand"
                onClick={() => updatePhase(pi, { tasks: [...phase.tasks, emptyTask()] })}
              >
                <Plus className="size-3.5" /> Add task
              </Button>
            </div>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button variant="brand" disabled={!valid || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : template ? "Save changes" : "Create template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
