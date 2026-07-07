import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

const REPORTS = [
  { name: "Project status report", desc: "Live status across all active projects.", tag: "Live" },
  { name: "Worker attendance — weekly", desc: "Clock-in, breaks, hours per worker.", tag: "Weekly" },
  { name: "Material usage by site", desc: "Materials issued vs delivered, per project.", tag: "Monthly" },
  { name: "Budget vs actuals", desc: "Spend tracking by project & phase.", tag: "Live" },
  { name: "Subcontractor performance", desc: "On-time delivery, rework rate, quality score.", tag: "Quarterly" },
  { name: "Job card export", desc: "Per-project PDF job card with photos.", tag: "On-demand" },
];

function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Operational and financial reports." />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.name} className="as-card p-5 flex flex-col">
            <FileText className="size-5 text-brand" />
            <h3 className="mt-3 font-semibold">{r.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{r.desc}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{r.tag}</span>
              <Button size="sm" variant="outline"><Download className="size-4" /> Export</Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
