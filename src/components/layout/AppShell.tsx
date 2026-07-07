import { Link, useRouterState } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/lib/auth-context";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getNavForRole, getMobileNavForRole } from "./nav-items";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (!user) return null;

  const nav = getNavForRole(user.role);
  const mobileNav = getMobileNavForRole(user.role);

  const isActive = (to: string) =>
    pathname === to || (to !== "/dashboard" && pathname.startsWith(to));

  return (
    <div className="min-h-dvh bg-background text-foreground as-grain">
      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Logo />
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
                    ? "bg-brand/15 text-brand"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="truncate">{item.label}</span>
                {active && <span className="ml-auto size-1.5 rounded-full bg-brand" />}
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
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-3 backdrop-blur lg:left-64 lg:h-16 lg:pl-72 lg:pr-6">
        <button
          className="grid size-9 place-items-center rounded-md border border-border lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="flex-1 lg:hidden">
          <Logo size={24} />
        </div>
        <div className="hidden flex-1 lg:block">
          <div className="text-sm text-muted-foreground">
            Welcome back, <span className="text-foreground font-medium">{user.name.split(" ")[0]}</span>
          </div>
        </div>
        <Link
          to="/notifications"
          className="relative grid size-9 place-items-center rounded-md border border-border hover:bg-accent as-press"
          aria-label="Notifications"
        >
          <Bell className="size-4" />
          <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand text-[9px] font-bold text-brand-foreground">
            3
          </span>
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
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar border-r border-sidebar-border">
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
                        ? "bg-brand/15 text-brand"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                    )}
                  >
                    <Icon className="size-4" />
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
      <main className="pb-24 lg:pb-10 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          {children}
        </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 px-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1.5">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to + item.label}
                to={item.to}
                className={cn(
                  "as-press flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "drop-shadow")} />
                <span className="truncate">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
