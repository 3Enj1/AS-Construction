import { Link } from "@tanstack/react-router";
import { StatusPill } from "@/components/ui/status-pill";
import { formatZAR } from "@/lib/format";
import type { Project } from "@/lib/types";
import { Calendar, MapPin, Users } from "lucide-react";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      to="/projects/$id"
      params={{ id: project.id }}
      className="as-card as-press group block overflow-hidden hover:border-brand/50"
    >
      <div
        className="relative h-28 w-full"
        style={{ background: project.coverGradient }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-card/95 to-transparent" />
        <div className="absolute left-4 top-4">
          <StatusPill status={project.status} kind="project" />
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <div className="text-[11px] font-mono text-foreground/70">{project.code}</div>
          <div className="truncate text-lg font-semibold leading-tight">
            {project.name}
          </div>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> {project.address.split(",")[1]?.trim() ?? project.address}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" /> {project.teamIds.length} on team
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" /> {new Date(project.targetDate).toLocaleDateString("en-ZA", { month: "short", year: "numeric" })}
          </span>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-foreground">{project.progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground">Budget</span>
          <span className="font-medium">
            {formatZAR(project.spent)} <span className="text-muted-foreground">/ {formatZAR(project.budget)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
