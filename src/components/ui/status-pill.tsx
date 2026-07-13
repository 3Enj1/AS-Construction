import { cn } from "@/lib/utils";
import type { ProjectStatus, TaskStatus } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-danger/15 text-danger border-danger/40",
  brand: "bg-brand/15 text-brand border-brand/40",
};

function toneForProject(s: ProjectStatus): Tone {
  switch (s) {
    case "Completed":
    case "Approved":
      return "success";
    case "In Progress":
    case "Scheduled":
      return "info";
    case "On Hold":
    case "Awaiting Materials":
    case "Awaiting Permits":
    case "Planning":
    case "Quality Check":
      return "warning";
    case "Cancelled":
      return "danger";
    case "New":
      return "brand";
    default:
      return "neutral";
  }
}

function toneForTask(s: TaskStatus): Tone {
  switch (s) {
    case "Approved":
      return "success";
    case "In Progress":
      return "brand";
    case "Submitted for Review":
      return "info";
    case "Assigned":
      return "neutral";
    case "Awaiting Materials":
    case "Blocked":
      return "warning";
    case "Rejected":
    case "Overdue":
      return "danger";
    case "Archived":
      return "neutral";
    default:
      return "neutral";
  }
}

function toneForGenericStatus(s: string): Tone {
  switch (s) {
    case "Approved":
    case "Delivered":
      return "success";
    case "Denied":
      return "danger";
    case "Pending":
      return "warning";
    default:
      return "neutral";
  }
}

export function StatusPill({
  status,
  kind,
  className,
}: {
  status: string;
  kind: "project" | "task" | "tone";
  className?: string;
}) {
  let tone: Tone = "neutral";
  if (kind === "project") tone = toneForProject(status as ProjectStatus);
  else if (kind === "task") tone = toneForTask(status as TaskStatus);
  else if (kind === "tone") tone = toneForGenericStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        TONE_CLASS[tone],
        className,
      )}
    >
      {tone === "danger" ? (
        <AlertTriangle className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-80" />
      )}
      {status}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {tone === "danger" && <AlertTriangle className="size-3" />}
      {children}
    </span>
  );
}
