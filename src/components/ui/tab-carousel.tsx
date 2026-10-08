import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabCarouselItem = {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

/**
 * Mobile tab switcher: a snap carousel that keeps the active tab centred
 * (glowing brand pill) with neighbours fading out at the edges. Swipe to
 * flick between tabs, tap one, or use the arrows; dots show position.
 */
export function TabCarousel({
  items,
  value,
  onValueChange,
  className,
}: {
  items: TabCarouselItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const firstScrollRef = useRef(true);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True only while the *user* is swiping/flinging the strip. Scrolls we start
  // ourselves (centring the active tab) must never be read back as a swipe —
  // that feedback loop is what made the carousel jitter.
  const userScrollRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const index = Math.max(
    0,
    items.findIndex((i) => i.value === value),
  );

  // Keep the active tab centred (instantly on first render, smoothly after),
  // skipping the scroll entirely when it's already there.
  useEffect(() => {
    const viewport = viewportRef.current;
    const el = itemRefs.current.get(value);
    if (!viewport || !el) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    const target = Math.min(
      max,
      Math.max(0, el.offsetLeft - (viewport.clientWidth - el.offsetWidth) / 2),
    );
    if (Math.abs(viewport.scrollLeft - target) > 2) {
      viewport.scrollTo({ left: target, behavior: firstScrollRef.current ? "auto" : "smooth" });
    }
    firstScrollRef.current = false;
  }, [value]);

  // Once a user swipe (including momentum) comes to rest, select whichever
  // tab landed in the centre.
  const settle = () => {
    if (!userScrollRef.current) return;
    userScrollRef.current = false;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const centre = viewport.scrollLeft + viewport.clientWidth / 2;
    let nearest: string | null = null;
    let best = Infinity;
    for (const [v, el] of itemRefs.current) {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centre);
      if (d < best) {
        best = d;
        nearest = v;
      }
    }
    if (nearest && nearest !== valueRef.current) onValueChange(nearest);
  };
  const onScroll = () => {
    if (!userScrollRef.current) return;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(settle, 160);
  };
  const markUserScroll = () => {
    userScrollRef.current = true;
  };
  useEffect(
    () => () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    [],
  );

  const go = (delta: number) => {
    const next = items[index + delta];
    if (!next) return;
    userScrollRef.current = false;
    onValueChange(next.value);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous tab"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card/80 text-muted-foreground backdrop-blur as-press active:bg-brand active:text-brand-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          {/* centre "lens" behind the active pill */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-xl"
          />
          <div
            ref={viewportRef}
            onScroll={onScroll}
            onTouchStart={markUserScroll}
            onPointerDown={markUserScroll}
            onWheel={markUserScroll}
            role="tablist"
            className="as-no-scrollbar as-fade-edges relative flex snap-x snap-mandatory items-center gap-2 overflow-x-auto py-2"
            /* enough side padding that even the first/last (narrowest) tab can sit centred */
            style={{ paddingInline: "calc(50% - 2.5rem)" }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.value === value;
              return (
                <button
                  key={item.value}
                  ref={(el) => {
                    if (el) itemRefs.current.set(item.value, el);
                    else itemRefs.current.delete(item.value);
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    userScrollRef.current = false;
                    onValueChange(item.value);
                  }}
                  className={cn(
                    "relative flex h-10 shrink-0 snap-center snap-always items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-all duration-300",
                    active
                      ? "scale-105 bg-brand text-brand-foreground shadow-glow-brand"
                      : "scale-90 border border-border bg-card/60 text-muted-foreground opacity-60",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                  {!!item.badge && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-[10px] font-semibold",
                        active
                          ? "bg-brand-foreground text-brand"
                          : "bg-brand text-brand-foreground",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === items.length - 1}
          aria-label="Next tab"
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card/80 text-muted-foreground backdrop-blur as-press active:bg-brand active:text-brand-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* position dots */}
      <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
        {items.map((item, i) => (
          <span
            key={item.value}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              i === index ? "w-5 bg-brand shadow-glow-brand" : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}
