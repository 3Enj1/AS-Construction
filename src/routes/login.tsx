import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { imageForId } from "@/lib/stock-images";
import { ArrowRight, HardHat, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(code, password);
      toast.success(`Welcome, ${user.name.split(" ")[0]}`);
      navigate({ to: user.acknowledged ? "/dashboard" : "/acknowledge" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dark relative min-h-dvh overflow-hidden bg-background text-foreground">
      <img
        src={imageForId("login-hero")}
        alt=""
        className="as-kenburns absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/50" />
      <div className="absolute inset-0 as-grain pointer-events-none" />
      <div className="relative mx-auto grid min-h-dvh max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
        {/* Brand panel */}
        <div className="hidden lg:flex lg:flex-col lg:justify-between lg:h-full">
          <Logo size={36} />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand" />
              Internal system · authorised access only
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight leading-tight">
              Build smarter.
              <br />
              <span className="text-brand">Track every site.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              The AS Construction Internal Management System — projects, phases, tasks, attendance,
              materials and reports, in one place for every role on every site.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-center">
              {[
                { k: "Active projects", v: "12" },
                { k: "On-site workers", v: "38" },
                { k: "On-time tasks", v: "94%" },
              ].map((m) => (
                <div key={m.k} className="as-card p-4">
                  <div className="text-2xl font-semibold tracking-tight">{m.v}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {m.k}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Andrew Stuart Construction. All rights reserved.
          </div>
        </div>

        {/* Login card */}
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden mb-6 flex flex-col items-center gap-2">
            <Logo size={32} />
          </div>
          <div className="as-card-glass p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand">
              <HardHat className="size-4" />
              Sign in
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Employee access</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Use your AS Construction employee code and password.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Employee code</Label>
                <Input
                  id="code"
                  placeholder="ASC-WRK-001"
                  autoComplete="username"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-11 uppercase tracking-wider"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <Button
                type="submit"
                variant="brand"
                shape="pill"
                disabled={busy}
                className="h-11 w-full as-press"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Sign in <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-success" />
                Accounts are created by Admin. No public registration.
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
