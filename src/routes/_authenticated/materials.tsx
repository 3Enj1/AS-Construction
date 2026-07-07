import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/status-pill";
import { DEMO_MATERIALS } from "@/lib/demo-data";
import { Button } from "@/components/ui/button";
import { Package, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsPage,
});

function MaterialsPage() {
  return (
    <>
      <PageHeader
        title="Materials"
        subtitle="Inventory and stock thresholds across all sites."
        actions={<Button className="bg-brand text-brand-foreground hover:bg-brand/90"><Plus className="size-4" /> Add material</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_MATERIALS.map((m) => {
          const ratio = m.stock / Math.max(m.threshold, 1);
          const tone = m.stock === 0 ? "danger" : ratio < 1 ? "warning" : "success";
          const pct = Math.min(100, Math.round(ratio * 100));
          return (
            <div key={m.id} className="as-card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.category}</div>
                  <div className="text-base font-semibold leading-tight">{m.name}</div>
                </div>
                <div className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground"><Package className="size-4" /></div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="text-2xl font-semibold">{m.stock.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{m.unit}</span></div>
                <Pill tone={tone}>
                  {m.stock === 0 ? "Out of stock" : ratio < 1 ? "Low" : "OK"}
                </Pill>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={"h-full rounded-full " + (tone === "danger" ? "bg-danger" : tone === "warning" ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Threshold {m.threshold}</span>
                <span>{m.supplier}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
