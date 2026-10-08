import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
  to,
  search,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger" | "info";
  className?: string;
  /** Make the whole card a tappable link to this page. */
  to?: string;
  /** Query params for `to`, e.g. { status: "overdue" }. */
  search?: Record<string, string>;
}) {
  const toneClass = {
    neutral: "text-muted-foreground bg-muted",
    brand: "text-brand bg-brand/15",
    success: "text-success bg-success/15",
    warning: "text-warning bg-warning/15",
    danger: "text-danger bg-danger/15",
    info: "text-info bg-info/15",
  }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
            {to && (
              <ChevronRight className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
            )}
          </div>
          <div className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div
            className={cn(
              "grid size-10 place-items-center rounded-full",
              toneClass,
              tone === "brand" && "shadow-glow-brand",
            )}
          >
            <Icon className="size-5" />
          </div>
        )}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        search={search}
        className={cn(
          "as-card as-card-loop as-press group block p-4 hover:border-brand/40 sm:p-5",
          className,
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={cn("as-card as-card-loop p-4 sm:p-5", className)}>{body}</div>;
}
