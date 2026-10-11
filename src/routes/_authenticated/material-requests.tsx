import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill, StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { RaiseRequestDialog } from "@/components/materials/RaiseRequestDialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/lib/auth-context";
import { fetchMaterialRequests, reviewMaterialRequest } from "@/lib/project-actions";
import type { MaterialRequest } from "@/lib/types";
import { relativeFromNow } from "@/lib/format";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/material-requests")({
  component: MaterialRequests,
});

function MaterialRequests() {
  const { hasRole, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["material-requests"],
    queryFn: () => fetchMaterialRequests(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["material-requests"] });
    qc.invalidateQueries({ queryKey: ["materials"] });
  };

  const review = useMutation({
    mutationFn: (input: { request: MaterialRequest; decision: "approved" | "denied" }) =>
      reviewMaterialRequest(input.request, input.decision),
    onSuccess: (_data, vars) => {
      toast.success(vars.decision === "approved" ? "Request approved" : "Request denied");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "Could not update request"),
  });

  return (
    <>
      <PageHeader
        title="Material Requests"
        subtitle="Requests raised by site teams for review."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="brand">
                <Plus className="size-4" /> Raise request
              </Button>
            </DialogTrigger>
            <RaiseRequestDialog
              onCreated={() => {
                setOpen(false);
                invalidate();
              }}
            />
          </Dialog>
        }
      />
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">No material requests yet.</div>
      ) : (
        <div className="as-card divide-y divide-border">
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3 min-w-0">
                {user && <UserAvatar user={user} size={36} />}
                <div className="min-w-0">
                  <div className="font-medium">
                    {r.material}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {r.quantity} {r.unit}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.projectName} · raised {relativeFromNow(r.createdAt)} by {r.requestedByName}
                  </div>
                  {r.notes && (
                    <div className="mt-0.5 text-xs italic text-muted-foreground">"{r.notes}"</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.urgency === "Urgent" && <Pill tone="danger">Urgent</Pill>}
                <StatusPill status={r.status} kind="tone" />
                {hasRole("admin") && r.status === "Pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-danger/40 text-danger hover:bg-danger/10"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ request: r, decision: "denied" })}
                    >
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      className="bg-success text-success-foreground hover:bg-success/90"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ request: r, decision: "approved" })}
                    >
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
