import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill, StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/lib/auth-context";
import {
  fetchMaterialRequests,
  fetchMaterials,
  fetchProjectsMini,
  raiseMaterialRequest,
  reviewMaterialRequest,
} from "@/lib/project-actions";
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
    queryFn: fetchMaterialRequests,
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
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.urgency === "Urgent" && <Pill tone="danger">Urgent</Pill>}
                <StatusPill status={r.status} kind="tone" />
                {hasRole("admin", "project_manager") && r.status === "Pending" && (
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

function RaiseRequestDialog({ onCreated }: { onCreated: () => void }) {
  const [projectId, setProjectId] = useState<string>("");
  const [materialId, setMaterialId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [urgent, setUrgent] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
  });
  const { data: materials = [] } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const create = useMutation({
    mutationFn: async () =>
      raiseMaterialRequest({
        projectId,
        materialId,
        quantity: Number(quantity),
        isUrgent: urgent,
      }),
    onSuccess: () => {
      toast.success("Request raised");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message || "Could not raise request"),
  });

  const valid = projectId && materialId && Number(quantity) > 0;

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Raise material request</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Material</Label>
          <Select value={materialId} onValueChange={setMaterialId}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              {materials.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} ({m.stock} {m.unit} in stock)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rr-qty">Quantity</Label>
          <Input
            id="rr-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={urgent} onCheckedChange={(v) => setUrgent(v === true)} />
          Urgent
        </label>
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Raising…" : "Raise request"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
