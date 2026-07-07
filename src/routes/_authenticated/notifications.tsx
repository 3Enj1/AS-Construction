import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/status-pill";
import { useAuth } from "@/lib/auth-context";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";
import { relativeFromNow } from "@/lib/format";
import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const ICON = { danger: AlertTriangle, warning: AlertTriangle, success: CheckCircle2, info: Info } as const;

function NotificationsPage() {
  const { user } = useAuth();
  if (!user) return null;
  const list = DEMO_NOTIFICATIONS.filter(
    (n) => (!n.forRole || n.forRole === user.role) && (!n.forUserId || n.forUserId === user.id),
  );
  return (
    <>
      <PageHeader title="Notifications" subtitle="Updates from across the system." />
      <div className="as-card divide-y divide-border">
        {list.map((n) => {
          const Icon = ICON[n.kind];
          return (
            <div key={n.id} className="flex gap-3 p-4">
              <div className={
                "grid size-9 shrink-0 place-items-center rounded-md " +
                (n.kind === "danger" ? "bg-danger/15 text-danger" : n.kind === "warning" ? "bg-warning/15 text-warning" : n.kind === "success" ? "bg-success/15 text-success" : "bg-info/15 text-info")
              }>
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium">{n.title}</div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{relativeFromNow(n.at)}</span>
                </div>
                <div className="mt-0.5 text-sm text-muted-foreground">{n.body}</div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 size-6" />
            You're all caught up.
          </div>
        )}
      </div>
    </>
  );
}
