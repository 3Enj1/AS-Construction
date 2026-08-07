import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronRight, KeyRound, LogOut, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  if (!user) return null;

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account and app preferences." />

      <div className="grid gap-6 lg:max-w-2xl">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Appearance
          </h2>
          <div className="as-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Theme</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Switch between light and dark mode.
                </p>
              </div>
              <div className="inline-flex rounded-md border border-border p-1">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={cn(
                    "as-press inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium",
                    theme === "light"
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Sun className="size-3.5" /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "as-press inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium",
                    theme === "dark"
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Moon className="size-3.5" /> Dark
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* user is always the signed-in account's own full profile (self-read
            RLS), so email is always populated here — unlike allUsers, which
            only carries the safe directory subset. */}
        <ChangePasswordSection email={user.email!} />

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Account
          </h2>
          <div className="as-card divide-y divide-border">
            <Link
              to="/profile"
              className="as-press flex items-center gap-3 p-4 sm:p-5 hover:bg-accent"
            >
              <UserAvatar user={user} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">
                  {ROLE_LABEL[user.role]} · {user.employeeCode}
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div>
                <div className="text-sm font-medium">Sign out</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  End your session on this device.
                </p>
              </div>
              <Button variant="outline" onClick={logout}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ChangePasswordSection({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 8) {
        throw new Error("New password must be at least 8 characters.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation don't match.");
      }
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (reauthError) throw new Error("Current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Security
      </h2>
      <div className="as-card p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-4 text-muted-foreground" /> Change password
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          You'll need your current password to set a new one.
        </p>
        <div className="mt-4 grid gap-3 sm:max-w-sm">
          <div className="grid gap-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            variant="brand"
            className="justify-self-start"
            disabled={!canSubmit || changePassword.isPending}
            onClick={() => changePassword.mutate()}
          >
            {changePassword.isPending ? "Updating…" : "Update password"}
          </Button>
        </div>
      </div>
    </section>
  );
}
