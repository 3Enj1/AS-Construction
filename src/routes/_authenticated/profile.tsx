import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { LogOut, Mail, Phone, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <>
      <PageHeader title="My profile" />
      <div className="as-card p-6">
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar user={user} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{user.name}</h2>
            <div className="text-sm text-muted-foreground">{user.jobTitle} · {ROLE_LABEL[user.role]}</div>
            <code className="mt-1 inline-block text-xs font-mono text-brand">{user.employeeCode}</code>
          </div>
          <Button variant="outline" onClick={logout}><LogOut className="size-4" /> Sign out</Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground"><Mail className="size-3.5" /> Email</div>
            <div className="mt-1 text-sm">{user.email}</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground"><Phone className="size-3.5" /> Phone</div>
            <div className="mt-1 text-sm">{user.phone ?? "—"}</div>
          </div>
        </div>

        <div className="mt-6 rounded-md border border-success/30 bg-success/10 p-4 text-sm">
          <div className="flex items-center gap-2 text-success font-medium"><ShieldCheck className="size-4" /> Acknowledgement on file</div>
          <p className="mt-1 text-muted-foreground">
            Accepted{user.acknowledgedAt ? ` on ${formatDate(user.acknowledgedAt)}` : ""}.
          </p>
        </div>
      </div>
    </>
  );
}
