import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/types";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const { allUsers } = useAuth();
  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Manually created by Admin. No public sign-up."
        actions={<Button className="bg-brand text-brand-foreground hover:bg-brand/90"><Plus className="size-4" /> Add user</Button>}
      />
      <div className="as-card divide-y divide-border">
        {allUsers.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar user={u} size={40} />
              <div className="min-w-0">
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.jobTitle} · {u.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <code className="text-[11px] font-mono text-brand">{u.employeeCode}</code>
              <Pill tone={u.role === "admin" ? "brand" : u.role === "client" ? "info" : "neutral"}>{ROLE_LABEL[u.role]}</Pill>
              <Pill tone={u.acknowledged ? "success" : "warning"}>
                {u.acknowledged ? "Active" : "First-login pending"}
              </Pill>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
