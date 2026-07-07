import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileBox, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

type TemplateRow = { id: string; template_name: string; description: string | null };
type TaskTemplateRow = {
  id: string;
  project_template_id: string;
  phase_name: string;
  phase_description: string | null;
  task_title: string;
  sort_order: number;
};

function TemplatesPage() {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["project-templates"],
    queryFn: async () => {
      const { data: tpls, error } = await supabase
        .from("project_templates")
        .select("id,template_name,description")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const { data: tasks, error: tErr } = await supabase
        .from("task_templates")
        .select("id,project_template_id,phase_name,phase_description,task_title,sort_order")
        .order("sort_order", { ascending: true });
      if (tErr) throw tErr;
      return ((tpls as TemplateRow[]) ?? []).map((tpl) => {
        const ttasks = ((tasks as TaskTemplateRow[]) ?? []).filter((t) => t.project_template_id === tpl.id);
        const phaseOrder: string[] = [];
        const groups = new Map<string, TaskTemplateRow[]>();
        for (const t of ttasks) {
          if (!groups.has(t.phase_name)) {
            phaseOrder.push(t.phase_name);
            groups.set(t.phase_name, []);
          }
          groups.get(t.phase_name)!.push(t);
        }
        return {
          id: tpl.id,
          name: tpl.template_name,
          description: tpl.description,
          phases: phaseOrder.map((name) => ({ name, tasks: groups.get(name)! })),
        };
      });
    },
  });

  return (
    <>
      <PageHeader
        title="Project Templates"
        subtitle="Reusable phase/task templates. Selecting one when creating a project auto-generates suggested phases and tasks."
        actions={
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90" disabled>
            <Plus className="size-4" /> New template
          </Button>
        }
      />
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">No templates yet.</div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="as-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-brand">
                    <FileBox className="size-3.5" /> Template
                  </div>
                  <h3 className="mt-1 text-lg font-semibold tracking-tight">{tpl.name}</h3>
                  {tpl.description && <p className="mt-1 text-sm text-muted-foreground">{tpl.description}</p>}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {tpl.phases.map((ph, i) => (
                  <div key={i} className="rounded-md border border-border bg-surface-2 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{i + 1}. {ph.name}</div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ph.tasks.length} tasks</span>
                    </div>
                    <ul className="mt-1.5 grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                      {ph.tasks.map((t) => (
                        <li key={t.id} className="flex items-start gap-1.5">
                          <span className="mt-1.5 size-1 rounded-full bg-brand" />
                          {t.task_title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
