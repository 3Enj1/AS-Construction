import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchMaterials, fetchProjectsMini, raiseMaterialRequest } from "@/lib/project-actions";
import { toast } from "sonner";

/** Raise a material request. Pass `projectId` to lock it to one project (the
 * project page's Materials tab); omit it to show a project picker. */
export function RaiseRequestDialog({
  projectId: fixedProjectId,
  onCreated,
}: {
  projectId?: string;
  onCreated: () => void;
}) {
  const [projectId, setProjectId] = useState<string>(fixedProjectId ?? "");
  const [materialId, setMaterialId] = useState<string>("");
  const [quantity, setQuantity] = useState("");
  const [urgent, setUrgent] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
    enabled: !fixedProjectId,
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
