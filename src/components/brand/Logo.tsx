import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 28,
  compact = false,
}: {
  className?: string;
  size?: number;
  /** Phones: show only the AS mark (text from `sm` up), keeping the header's
   * centre clear of the notch / Dynamic Island. */
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative grid place-items-center rounded-md bg-brand text-brand-foreground font-black tracking-tighter shadow-glow-brand"
        style={{ width: size, height: size, fontSize: size * 0.46 }}
      >
        AS
        <span className="absolute inset-0 rounded-md ring-1 ring-white/10" />
      </div>
      <div className={cn("leading-tight", compact && "hidden sm:block")}>
        <div className="text-[13px] font-semibold tracking-wide text-foreground">
          AS Construction
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Internal Management
        </div>
      </div>
    </div>
  );
}
