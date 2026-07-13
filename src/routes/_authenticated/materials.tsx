import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { fetchMaterials, addMaterial, receiveStock } from "@/lib/project-actions";
import type { Material } from "@/lib/types";
import { toast } from "sonner";
import { Package, PackagePlus, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsPage,
});

function MaterialsPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [receiveFor, setReceiveFor] = useState<Material | null>(null);
  const canManageStock = hasRole("admin", "project_manager", "site_supervisor");

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: fetchMaterials,
  });

  return (
    <>
      <PageHeader
        title="Materials"
        subtitle="Inventory and stock thresholds across all sites."
        actions={
          canManageStock && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="size-4" /> Add material
                </Button>
              </DialogTrigger>
              <AddMaterialDialog
                onCreated={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["materials"] });
                }}
              />
            </Dialog>
          )
        }
      />
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading materials…</div>
      ) : materials.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">No materials yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => {
            const ratio = m.stock / Math.max(m.threshold, 1);
            const tone = m.stock === 0 ? "danger" : ratio < 1 ? "warning" : "success";
            const pct = Math.min(100, Math.round(ratio * 100));
            return (
              <div key={m.id} className="as-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {m.category}
                    </div>
                    <div className="text-base font-semibold leading-tight">{m.name}</div>
                  </div>
                  <div className="grid size-9 place-items-center rounded-md bg-muted text-muted-foreground">
                    <Package className="size-4" />
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between">
                  <div className="text-2xl font-semibold">
                    {m.stock.toLocaleString()}{" "}
                    <span className="text-xs font-normal text-muted-foreground">{m.unit}</span>
                  </div>
                  <Pill tone={tone}>
                    {m.stock === 0 ? "Out of stock" : ratio < 1 ? "Low" : "OK"}
                  </Pill>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={
                      "h-full rounded-full " +
                      (tone === "danger"
                        ? "bg-danger"
                        : tone === "warning"
                          ? "bg-warning"
                          : "bg-success")
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Threshold {m.threshold}</span>
                  <span>{m.supplier}</span>
                </div>
                {canManageStock && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full"
                    onClick={() => setReceiveFor(m)}
                  >
                    <PackagePlus className="size-4" /> Receive stock
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!receiveFor} onOpenChange={(o) => !o && setReceiveFor(null)}>
        {receiveFor && (
          <ReceiveStockDialog
            material={receiveFor}
            onDone={() => {
              setReceiveFor(null);
              qc.invalidateQueries({ queryKey: ["materials"] });
            }}
          />
        )}
      </Dialog>
    </>
  );
}

function ReceiveStockDialog({
  material,
  onDone,
}: {
  material: Material;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const receive = useMutation({
    mutationFn: () => receiveStock({ materialId: material.id, quantity: Number(quantity), note }),
    onSuccess: () => {
      toast.success("Stock received");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not receive stock"),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Receive stock — {material.name}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rs-qty">Quantity received ({material.unit})</Label>
          <Input
            id="rs-qty"
            type="number"
            min={0}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rs-note">Note (optional)</Label>
          <Input
            id="rs-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. delivery reference"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={!Number(quantity) || receive.isPending}
          onClick={() => receive.mutate()}
        >
          {receive.isPending ? "Receiving…" : "Receive stock"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddMaterialDialog({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [stock, setStock] = useState("");
  const [threshold, setThreshold] = useState("");
  const [supplier, setSupplier] = useState("");

  const create = useMutation({
    mutationFn: async () =>
      addMaterial({
        name: name.trim(),
        category: category.trim(),
        unit: unit.trim(),
        stock: Number(stock) || 0,
        threshold: Number(threshold) || 0,
        supplier: supplier.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Material added");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message || "Could not add material"),
  });

  const valid = name.trim() && category.trim() && unit.trim();

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add material</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="am-name">Material name</Label>
          <Input
            id="am-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Cement (50kg)"
          />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="am-category">Category</Label>
            <Input
              id="am-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Bulk"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="am-unit">Unit</Label>
            <Input
              id="am-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. bags"
            />
          </div>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="am-stock">Current stock</Label>
            <Input
              id="am-stock"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="am-threshold">Low-stock threshold</Label>
            <Input
              id="am-threshold"
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="am-supplier">Supplier</Label>
          <Input id="am-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          variant="brand"
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Adding…" : "Add material"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
