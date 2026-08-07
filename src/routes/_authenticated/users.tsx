import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccessRestricted } from "@/components/layout/AccessRestricted";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/user-avatar";
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
import { useAuth } from "@/lib/auth-context";
import { fetchOnSiteProfileIds } from "@/lib/project-actions";
import { createEmployee } from "@/lib/auth.functions";
import { ROLE_LABEL, type Role } from "@/lib/types";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const { allUsers, refreshAllUsers, hasRole } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: onSite = new Set<string>() } = useQuery({
    queryKey: ["on-site-profile-ids"],
    queryFn: fetchOnSiteProfileIds,
  });

  if (!hasRole("admin")) {
    return (
      <>
        <PageHeader title="Team" subtitle="Manually created by Admin. No public sign-up." />
        <AccessRestricted />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Manually created by Admin. No public sign-up."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="brand">
                <Plus className="size-4" /> Add user
              </Button>
            </DialogTrigger>
            <AddUserDialog
              onDone={() => {
                setOpen(false);
                refreshAllUsers();
              }}
            />
          </Dialog>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allUsers.map((u) => {
          const isOnSite = onSite.has(u.id);
          return (
            <div key={u.id} className="as-card p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <UserAvatar user={u} size={44} />
                  <span
                    className={
                      "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card " +
                      (isOnSite ? "bg-success" : "bg-muted-foreground/50")
                    }
                    title={isOnSite ? "On site now" : "Off site"}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.jobTitle}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="text-[11px] font-mono text-brand">{u.employeeCode}</code>
                <Pill
                  tone={u.role === "admin" ? "brand" : u.role === "client" ? "info" : "neutral"}
                >
                  {ROLE_LABEL[u.role]}
                </Pill>
                <Pill tone={u.acknowledged ? "success" : "warning"}>
                  {u.acknowledged ? "Active" : "First-login pending"}
                </Pill>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const ROLES: Role[] = [
  "admin",
  "project_manager",
  "site_supervisor",
  "worker",
  "subcontractor",
  "client",
];

function AddUserDialog({ onDone }: { onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("worker");
  const [password, setPassword] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createEmployee({
        data: {
          fullName: fullName.trim(),
          employeeCode: employeeCode.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          role,
          password,
        },
      }),
    onSuccess: () => {
      toast.success(
        `${fullName.trim()} added — share their employee code and password to sign in.`,
      );
      onDone();
    },
    onError: (e: Error) => toast.error(e.message || "Could not add user"),
  });

  const valid =
    fullName.trim().length >= 2 &&
    employeeCode.trim().length >= 3 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    password.length >= 8;

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add user</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="au-name">Full name</Label>
          <Input id="au-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="au-code">Employee code</Label>
            <Input
              id="au-code"
              placeholder="ASC-ADM-002"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className="uppercase"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="au-email">Email</Label>
            <Input
              id="au-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="au-phone">Phone (optional)</Label>
            <Input id="au-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="au-password">Password</Label>
          <Input
            id="au-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <p className="text-xs text-muted-foreground">
            Share this employee code and password with them directly — there's no email invite flow.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!valid || create.isPending}
          onClick={() => create.mutate()}
          variant="brand"
        >
          {create.isPending ? "Adding…" : "Add user"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
