import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  fetchAttendanceLogs,
  fetchBudgetSummary,
  fetchMaterialRequests,
  fetchProjectsMini,
} from "@/lib/project-actions";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportProjectStatus() {
  const { data, error } = await supabase
    .from("projects")
    .select("project_name,client_name,status,priority,start_date,expected_completion_date")
    .eq("is_archived", false)
    .order("project_name", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []).map((p) => [
    p.project_name,
    p.client_name ?? "",
    p.status,
    p.priority,
    p.start_date ?? "",
    p.expected_completion_date ?? "",
  ]);
  downloadCsv(
    "project-status-report.csv",
    toCsv(["Project", "Client", "Status", "Priority", "Start date", "Target completion"], rows),
  );
}

function useReports() {
  const { allUsers } = useAuth();

  const exportAttendanceWeekly = async () => {
    const logs = await fetchAttendanceLogs();
    const projects = await fetchProjectsMini();
    const rows = logs.map((a) => {
      const u = allUsers.find((x) => x.id === a.userId);
      const p = projects.find((x) => x.id === a.projectId);
      const end = a.clockOut ? new Date(a.clockOut).getTime() : Date.now();
      const hours = Math.max(
        0,
        (end - new Date(a.clockIn).getTime()) / 3_600_000 - a.breakMinutes / 60,
      );
      return [
        u?.name ?? "Unknown",
        u?.employeeCode ?? "",
        p?.project_name ?? "",
        a.clockIn,
        a.clockOut ?? "",
        a.breakMinutes,
        hours.toFixed(2),
        a.status,
      ];
    });
    downloadCsv(
      "worker-attendance-weekly.csv",
      toCsv(
        [
          "Worker",
          "Employee code",
          "Site",
          "Clock-in",
          "Clock-out",
          "Break (min)",
          "Hours worked",
          "Status",
        ],
        rows,
      ),
    );
  };

  const exportMaterialUsage = async () => {
    const requests = await fetchMaterialRequests();
    const relevant = requests.filter((r) => r.status === "Approved" || r.status === "Delivered");
    const rows = relevant.map((r) => [
      r.material,
      r.projectName ?? "",
      r.quantity,
      r.unit,
      r.status,
      r.requestedByName ?? "",
      r.createdAt,
    ]);
    downloadCsv(
      "material-usage-by-site.csv",
      toCsv(
        ["Material", "Project", "Quantity", "Unit", "Status", "Requested by", "Requested at"],
        rows,
      ),
    );
  };

  const exportBudgetVsActuals = async () => {
    const summary = await fetchBudgetSummary();
    const rows = summary.map((p) => {
      const remaining = p.budget != null ? p.budget - p.spent : "";
      const pctUsed = p.budget ? Math.round((p.spent / p.budget) * 100) : "";
      return [
        p.projectName,
        p.budget ?? "",
        p.spent.toFixed(2),
        remaining === "" ? "" : Number(remaining).toFixed(2),
        pctUsed === "" ? "" : `${pctUsed}%`,
      ];
    });
    downloadCsv(
      "budget-vs-actuals.csv",
      toCsv(["Project", "Budget", "Spent", "Remaining", "% used"], rows),
    );
  };

  return { exportProjectStatus, exportAttendanceWeekly, exportMaterialUsage, exportBudgetVsActuals };
}

function ReportsPage() {
  const {
    exportProjectStatus: exportProjects,
    exportAttendanceWeekly,
    exportMaterialUsage,
    exportBudgetVsActuals,
  } = useReports();
  const [exporting, setExporting] = useState<string | null>(null);

  const REPORTS: { name: string; desc: string; tag: string; run?: () => Promise<void> }[] = [
    {
      name: "Project status report",
      desc: "Live status across all active projects.",
      tag: "Live",
      run: exportProjects,
    },
    {
      name: "Worker attendance — weekly",
      desc: "Clock-in, breaks, hours per worker.",
      tag: "Weekly",
      run: exportAttendanceWeekly,
    },
    {
      name: "Material usage by site",
      desc: "Materials issued vs delivered, per project.",
      tag: "Monthly",
      run: exportMaterialUsage,
    },
    {
      name: "Budget vs actuals",
      desc: "Spend tracking by project.",
      tag: "Live",
      run: exportBudgetVsActuals,
    },
    {
      name: "Subcontractor performance",
      desc: "On-time delivery, rework rate, quality score.",
      tag: "Coming soon",
    },
    { name: "Job card export", desc: "Per-project PDF job card with photos.", tag: "Coming soon" },
  ];

  const handleExport = async (r: (typeof REPORTS)[number]) => {
    if (!r.run) return;
    setExporting(r.name);
    try {
      await r.run();
      toast.success(`${r.name} exported`);
    } catch (e) {
      toast.error((e as Error).message || "Export failed");
    } finally {
      setExporting(null);
    }
  };

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
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {r.tag}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={!r.run || exporting === r.name}
                onClick={() => handleExport(r)}
              >
                <Download className="size-4" /> {exporting === r.name ? "Exporting…" : "Export"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
