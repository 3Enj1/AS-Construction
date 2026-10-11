import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchProjectsMini, raiseMaterialRequest } from "@/lib/project-actions";
import { toast } from "sonner";

/** Raise a material request by typing what's needed (no inventory list).
 * Pass `projectId` to lock it to one project (the project page's Materials
 * tab); omit it to show a picker of the projects the user can see. */
export function RaiseRequestDialog({
  projectId: fixedProjectId,
  onCreated,
}: {
  projectId?: string;
  onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState<string>(fixedProjectId ?? "");
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [urgent, setUrgent] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
    enabled: !fixedProjectId,
  });

  const create = useMutation({
    mutationFn: async () =>
      raiseMaterialRequest({
        projectId,
        materialName: materialName.trim(),
        quantity: Number(quantity),
        unit: unit.trim() || null,
        notes: notes.trim() || null,
        isUrgent: urgent,
      }),
    onSuccess: () => {
      toast.success("Request sent");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message || "Could not send request"),
  });

  const valid = !!projectId && !!materialName.trim() && Number(quantity) > 0;

  return (
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Request materials</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        {!fixedProjectId && (
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
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="rr-name">Material</Label>
          <Input
            id="rr-name"
            placeholder="e.g. Cement, 6mm rebar, roof sheeting"
            value={materialName}
            onChange={(e) => setMaterialName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rr-qty">Quantity</Label>
            <Input
              id="rr-qty"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rr-unit">Unit (optional)</Label>
            <Input
              id="rr-unit"
              placeholder="bags, m, sheets…"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rr-notes">Note (optional)</Label>
          <Textarea
            id="rr-notes"
            rows={2}
            placeholder="Where it's needed, by when, size or brand…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
          {create.isPending ? "Sending…" : "Send request"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
