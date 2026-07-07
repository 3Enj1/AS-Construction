import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { DEMO_PROJECTS } from "@/lib/demo-data";

export function ClientDashboard() {
  // Clients see only projects assigned to them — demo: first project.
  const my = DEMO_PROJECTS.slice(0, 1);
  return (
    <>
      <PageHeader title="My project" subtitle="Approved progress updates from your build team." />
      <div className="grid gap-4 lg:grid-cols-2">
        {my.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
      <div className="mt-8 as-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Latest approved update</h3>
        <p className="mt-3 text-sm leading-relaxed">
          Brickwork on the north elevation is on track for completion this week.
          Roof trusses are scheduled for delivery on 28 May. Andrew will be on
          site for a client walkthrough on Friday at 14h00.
        </p>
      </div>
    </>
  );
}
