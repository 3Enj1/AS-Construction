import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectsMap } from "@/components/map/ProjectsMap";
import { fetchProjectPins } from "@/lib/project-actions";
import { colorForProjectStatus } from "@/lib/map-utils";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/map")({
  component: ProjectMapPage,
});

const STATUS_FILTERS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Active", value: "active" },
  { label: "Planning", value: "planning" },
  { label: "On hold", value: "on_hold" },
  { label: "Completed", value: "completed" },
  { label: "Archived", value: "archived" },
];

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

function ProjectMapPage() {
  const [filter, setFilter] = useState<string | null>(null);

  const { data: pins = [], isLoading } = useQuery({
    queryKey: ["project-pins"],
    queryFn: fetchProjectPins,
  });

  const filtered = filter ? pins.filter((p) => p.status === filter) : pins;

  return (
    <>
      <PageHeader
        title="Project Map"
        subtitle="Where our work has happened across Southern Africa."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "as-press rounded-full border px-3 py-1 text-xs font-medium",
              filter === f.value
                ? "border-brand bg-brand/15 text-brand"
                : "border-border text-muted-foreground hover:border-brand/40",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading map…</div>
      ) : (
        <ProjectsMap pins={filtered} height={520} />
      )}

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pinned projects
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] normal-case tracking-normal text-foreground">
            {filtered.length}
          </span>
        </h2>
        {filtered.length === 0 ? (
          <div className="as-card p-6 text-sm text-muted-foreground">
            <MapPin className="mx-auto mb-2 size-6" />
            <p className="text-center">
              No pinned projects yet. Add a location when creating or editing a project and it'll
              show up here.
            </p>
          </div>
        ) : (
          <div className="as-card divide-y divide-border">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="as-press flex items-center gap-3 p-4 hover:bg-accent/30"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: colorForProjectStatus(p.status) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  {p.address && (
                    <div className="text-xs text-muted-foreground truncate">{p.address}</div>
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
