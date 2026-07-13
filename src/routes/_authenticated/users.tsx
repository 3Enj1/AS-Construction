import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/lib/auth-context";
import { fetchOnSiteProfileIds } from "@/lib/project-actions";
import { ROLE_LABEL } from "@/lib/types";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const { allUsers } = useAuth();
  const { data: onSite = new Set<string>() } = useQuery({
    queryKey: ["on-site-profile-ids"],
    queryFn: fetchOnSiteProfileIds,
  });

  return (
    <>
      <PageHeader
        title="Team"
        subtitle="Manually created by Admin. No public sign-up."
        actions={
          <Button variant="brand">
            <Plus className="size-4" /> Add user
          </Button>
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
