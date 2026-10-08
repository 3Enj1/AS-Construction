import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectChatPanel } from "@/components/chat/ProjectChatPanel";
import { fetchProjectsMini } from "@/lib/project-actions";
import { gradientFromId } from "@/lib/project-mapper";
import { codeFromProjectId } from "@/lib/task-mapper";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  const [active, setActive] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
  });
  const activeId = active ?? projects[0]?.id ?? null;

  return (
    <>
      <PageHeader title="Project Chat" subtitle="Per-project conversations with your team." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="as-card divide-y divide-border lg:max-h-[600px] lg:overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={
                "flex w-full items-start gap-3 p-3 text-left hover:bg-accent as-press " +
                (activeId === p.id ? "bg-brand/10" : "")
              }
            >
              <div className="size-9 rounded-md" style={{ background: gradientFromId(p.id) }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.project_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {codeFromProjectId(p.id)}
                </div>
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No projects to chat about yet.</div>
          )}
        </div>

        <ProjectChatPanel projectId={activeId} />
      </div>
    </>
  );
}
