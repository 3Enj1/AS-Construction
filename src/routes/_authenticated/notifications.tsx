import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/lib/auth-context";
import { fetchNotifications, markNotificationRead } from "@/lib/project-actions";
import { relativeFromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, CheckCircle2, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const ICON = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
} as const;

const TONE = {
  danger: "bg-danger/15 text-danger",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
} as const;

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: fetchNotifications,
    enabled: !!user,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  if (!user) return null;

  return (
    <>
      <PageHeader title="Notifications" subtitle="Updates from across the system." />
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading notifications…</div>
      ) : (
        <div className="as-card divide-y divide-border">
          {list.map((n) => {
            const Icon = ICON[n.kind];
            const isMine = n.forUserId === user.id;
            const unread = isMine && !n.read;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => isMine && !n.read && markRead.mutate(n.id)}
                className={cn(
                  "as-press flex w-full gap-3 p-4 text-left",
                  unread ? "bg-accent/40 hover:bg-accent/60" : "hover:bg-accent/30",
                )}
              >
                <div className={cn("grid size-9 shrink-0 place-items-center rounded-md", TONE[n.kind])}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-medium">
                      {n.title}
                      {unread && <span className="size-1.5 shrink-0 rounded-full bg-brand" />}
                    </div>
                    <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-muted-foreground">
                      {relativeFromNow(n.at)}
                    </span>
                  </div>
                  {n.body && <div className="mt-0.5 text-sm text-muted-foreground">{n.body}</div>}
                </div>
              </button>
            );
          })}
          {list.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 size-6" />
              You're all caught up.
            </div>
          )}
        </div>
      )}
    </>
  );
}
