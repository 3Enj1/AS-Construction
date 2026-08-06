import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { TemplateBuilderDialog } from "@/components/templates/TemplateBuilderDialog";
import { useAuth } from "@/lib/auth-context";
import { archiveTemplate, fetchTemplates, type TemplateFull } from "@/lib/project-actions";
import { templateVisual } from "@/lib/template-visuals";
import { imageForTemplateCategory } from "@/lib/stock-images";
import { toast } from "sonner";
import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

function TemplatesPage() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = hasRole("admin");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateFull | undefined>(undefined);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["project-templates"],
    queryFn: fetchTemplates,
  });

  const archive = useMutation({
    mutationFn: (id: string) => archiveTemplate(id),
    onSuccess: () => {
      toast.success("Template archived");
      qc.invalidateQueries({ queryKey: ["project-templates"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not archive template"),
  });

  const openCreate = () => {
    setEditing(undefined);
    setOpen(true);
  };
  const openEdit = (tpl: TemplateFull) => {
    setEditing(tpl);
    setOpen(true);
  };
  const startProjectFromTemplate = (id: string) => {
    navigate({ to: "/projects", search: { template: id } });
  };

  return (
    <>
      <PageHeader
        title="Project Templates"
        subtitle="Reusable phase/task templates. Selecting one when creating a project auto-generates suggested phases and tasks."
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="brand" onClick={openCreate}>
                  <Plus className="size-4" /> New template
                </Button>
              </DialogTrigger>
              <TemplateBuilderDialog template={editing} onDone={() => setOpen(false)} />
            </Dialog>
          )
        }
      />
      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="as-card h-64 animate-pulse p-5">
              <div className="h-20 rounded-md bg-surface-2" />
              <div className="mt-4 h-4 w-1/2 rounded bg-surface-2" />
              <div className="mt-2 h-3 w-3/4 rounded bg-surface-2" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">No templates yet.</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {templates.map((tpl, idx) => {
            const visual = templateVisual(tpl.category);
            const Icon = visual.icon;
            const taskCount = tpl.phases.reduce((n, p) => n + p.tasks.length, 0);
            return (
              <div
                key={tpl.id}
                className="as-card animate-in fade-in slide-in-from-bottom-2 overflow-hidden duration-500 fill-mode-both"
                style={{ animationDelay: `${idx * 70}ms` }}
              >
                <div className="dark relative h-36 w-full" style={{ background: visual.gradient }}>
                  <img
                    src={imageForTemplateCategory(tpl.category)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1 text-[11px] uppercase tracking-wider text-white/90 backdrop-blur-sm">
                    <Icon className="size-3.5" /> {visual.label}
                  </div>
                </div>
                <div className="as-card-glass relative -mt-6 mx-3 rounded-b-none p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-tight">{tpl.name}</h3>
                      {tpl.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{tpl.description}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(tpl)}
                          aria-label="Edit template"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-danger"
                          onClick={() => archive.mutate(tpl.id)}
                          disabled={archive.isPending}
                          aria-label="Archive template"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {tpl.phases.map((ph, i) => (
                      <div key={i} className="rounded-md border border-border bg-surface-2 p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">
                            {i + 1}. {ph.name}
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {ph.tasks.length} tasks
                          </span>
                        </div>
                        <ul className="mt-1.5 grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                          {ph.tasks.map((t) => (
                            <li key={t.id} className="flex items-start gap-1.5">
                              <span className="mt-1.5 size-1 rounded-full bg-brand" />
                              {t.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-[11px] text-muted-foreground">
                      {tpl.phases.length} phases · {taskCount} tasks
                    </span>
                    <Button
                      size="sm"
                      variant="brand"
                      onClick={() => startProjectFromTemplate(tpl.id)}
                    >
                      Use this template <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
