import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill, StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DEMO_MATERIAL_REQUESTS, DEMO_PROJECTS, DEMO_USERS } from "@/lib/demo-data";
import { useAuth } from "@/lib/auth-context";
import { relativeFromNow } from "@/lib/format";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/material-requests")({
  component: MaterialRequests,
});

function MaterialRequests() {
  const { hasRole } = useAuth();
  return (
    <>
      <PageHeader
        title="Material Requests"
        subtitle="Requests raised by site teams for review."
        actions={<Button className="bg-brand text-brand-foreground hover:bg-brand/90"><Plus className="size-4" /> Raise request</Button>}
      />
      <div className="as-card divide-y divide-border">
        {DEMO_MATERIAL_REQUESTS.map((r) => {
          const project = DEMO_PROJECTS.find((p) => p.id === r.projectId);
          const by = DEMO_USERS.find((u) => u.id === r.requestedBy);
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3 min-w-0">
                {by && <UserAvatar user={by} size={36} />}
                <div className="min-w-0">
                  <div className="font-medium">{r.material} <span className="text-muted-foreground font-normal">· {r.quantity}</span></div>
                  <div className="text-xs text-muted-foreground">{project?.name} · raised {relativeFromNow(r.createdAt)} by {by?.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.urgency === "Urgent" && <Pill tone="danger">Urgent</Pill>}
                <StatusPill status={r.status} kind="tone" />
                {hasRole("admin", "project_manager") && r.status === "Pending" && (
                  <>
                    <Button size="sm" variant="outline" className="border-danger/40 text-danger hover:bg-danger/10">Deny</Button>
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">Approve</Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
