import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/brand/Logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchUnreadNotificationCount } from "@/lib/project-actions";
import { getNavForRole, getMobileNavForRole } from "./nav-items";
import { playNotifySound, vibrate } from "@/lib/feedback";
import { Bell, LogOut, Menu, PanelLeftClose, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const SIDEBAR_KEY = "as-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop sidebar can be closed; remembered per browser.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "closed") setSidebarOpen(false);
    } catch {
      // storage unavailable — default to open
    }
  }, []);
  const toggleSidebar = (open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed");
    } catch {
      // storage unavailable — state just isn't remembered
    }
  };
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread-count", user?.id],
    queryFn: () => fetchUnreadNotificationCount(user!.id),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Notify (sound + vibration) only when unread count *rises* — never on first
  // load, so existing unread notifications from before this session don't fire it.
  const prevUnreadRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (prevUnreadRef.current !== undefined && unreadCount > prevUnreadRef.current) {
      playNotifySound();
      vibrate(20);
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  if (!user) return null;

  const nav = getNavForRole(user.role);
  const mobileNav = getMobileNavForRole(user.role);

  const isActive = (to: string) =>
    pathname === to || (to !== "/dashboard" && pathname.startsWith(to));

  return (
    <div className="min-h-dvh bg-background text-foreground as-grain">
      {/* DESKTOP SIDEBAR */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar transition-transform duration-300 lg:flex",
          !sidebarOpen && "-translate-x-full",
        )}
        aria-hidden={!sidebarOpen}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border pl-5 pr-3">
          <Logo />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleSidebar(false)}
            aria-label="Close menu"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to + item.label}
                to={item.to}
                className={cn(
                  "as-press flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-brand text-brand-foreground shadow-glow-brand"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full",
                    active && "bg-brand-foreground/20",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="truncate">{item.label}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-brand-foreground" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-md p-2 hover:bg-sidebar-accent"
          >
            <UserAvatar user={user} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {ROLE_LABEL[user.role]} · {user.employeeCode}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </Link>
        </div>
      </aside>

      {/* TOP BAR (mobile + desktop) */}
      <header
        className={cn(
          "sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b border-border bg-background/80 pt-[env(safe-area-inset-top)] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] backdrop-blur transition-[padding] duration-300 lg:h-16 lg:pr-6",
          sidebarOpen ? "lg:pl-72" : "lg:pl-6",
        )}
      >
        <button
          className="grid size-9 place-items-center rounded-md border border-border lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        {!sidebarOpen && (
          <button
            className="hidden size-9 place-items-center rounded-md border border-border hover:bg-accent as-press lg:grid"
            onClick={() => toggleSidebar(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        )}
        <div className={cn("flex-1", sidebarOpen && "lg:hidden")}>
          <Logo size={30} compact />
        </div>
        <div className={cn("hidden", sidebarOpen && "flex-1 lg:block")}>
          <div className="text-sm text-muted-foreground">
            Welcome back,{" "}
            <span className="text-foreground font-medium">{user.name.split(" ")[0]}</span>
          </div>
        </div>
        <ThemeToggle />
        <Link
          to="/notifications"
          className="relative grid size-9 place-items-center rounded-md border border-border hover:bg-accent as-press"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 h-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-brand-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <Link to="/profile" className="lg:hidden">
          <UserAvatar user={user} size={32} />
        </Link>
      </header>

      {/* MOBILE OFF-CANVAS */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col border-r border-sidebar-border bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]">
            <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
              <Logo />
              <button
                className="grid size-9 place-items-center rounded-md border border-border"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to + item.label}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                      active
                        ? "bg-brand text-brand-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full",
                        active && "bg-brand-foreground/20",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-sidebar-border p-3">
              <Button variant="ghost" className="w-full justify-start" onClick={logout}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN */}
      <main
        className={cn(
          "pb-24 transition-[padding] duration-300 lg:pb-10",
          sidebarOpen && "lg:pl-64",
        )}
      >
        <div className="mx-auto w-full max-w-7xl py-5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:py-7 sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:px-8">
          {children}
        </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 pb-[max(env(safe-area-inset-bottom),0.25rem)] pl-[max(0.25rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] pt-1.5">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to + item.label}
                to={item.to}
                className={cn(
                  "as-press flex min-w-0 flex-col items-center gap-0.5 rounded-md px-0.5 py-1.5 text-[10px] font-medium",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_var(--brand)]")} />
                <span className="w-full truncate text-center leading-tight">
                  {item.short ?? item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
