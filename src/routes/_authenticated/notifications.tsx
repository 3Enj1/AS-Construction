import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  dismissAllNotifications,
  dismissNotification,
  fetchNotifications,
  markNotificationRead,
} from "@/lib/project-actions";
import { relativeFromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
import { toast } from "sonner";

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

  const dismiss = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e: Error) => toast.error(e.message || "Could not clear notification"),
  });

  const dismissAll = useMutation({
    mutationFn: () => dismissAllNotifications(list.map((n) => n.id)),
    onSuccess: () => {
      toast.success("Notifications cleared");
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not clear notifications"),
  });

  if (!user) return null;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates from across the system."
        actions={
          list.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={dismissAll.isPending}
              onClick={() => dismissAll.mutate()}
            >
              Clear all
            </Button>
          )
        }
      />
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading notifications…</div>
      ) : (
        <div className="as-card divide-y divide-border">
          {list.map((n) => {
            const Icon = ICON[n.kind];
            const isMine = n.forUserId === user.id;
            const unread = isMine && !n.read;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex w-full items-start gap-1 pr-2",
                  unread ? "bg-accent/40 hover:bg-accent/60" : "hover:bg-accent/30",
                )}
              >
                <button
                  type="button"
                  onClick={() => isMine && !n.read && markRead.mutate(n.id)}
                  className="as-press flex flex-1 gap-3 p-4 text-left"
                >
                  <div
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-md",
                      TONE[n.kind],
                    )}
                  >
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
                <button
                  type="button"
                  aria-label="Clear notification"
                  disabled={dismiss.isPending}
                  onClick={() => dismiss.mutate(n.id)}
                  className="as-press mt-4 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                >
                  <X className="size-4" />
                </button>
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
      )}
    </>
  );
}
