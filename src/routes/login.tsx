import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, HardHat, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const SEEDED_ACCOUNTS = [
  { name: "Andrew Stuart", role: "Admin",            code: "ASC-ADM-001", pwd: "Andrew2026!"  },
  { name: "Sarah Mitchell", role: "Project Manager", code: "ASC-PM-001",  pwd: "Password123!" },
  { name: "James Botha",   role: "Site Supervisor",  code: "ASC-SS-001",  pwd: "Password123!" },
  { name: "Thabo Nkosi",   role: "Worker",           code: "ASC-WRK-001", pwd: "Password123!" },
  { name: "RoofPro Subs",  role: "Subcontractor",    code: "ASC-SUB-001", pwd: "Password123!" },
  { name: "Mr & Mrs Patel", role: "Client",          code: "ASC-CL-001",  pwd: "Password123!" },
];

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

  const quickFill = (c: string, p: string) => {
    setCode(c);
    setPassword(p);
  };

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
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
              The AS Construction Internal Management System — projects,
              phases, tasks, attendance, materials and reports, in one place
              for every role on every site.
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
          <div className="as-card p-6 sm:p-8 shadow-card">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand">
              <HardHat className="size-4" />
              Sign in
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Employee access
            </h2>
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
                disabled={busy}
                className="h-11 w-full bg-brand text-brand-foreground hover:bg-brand/90 as-press"
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

          <details className="mt-4 as-card p-4 text-sm">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Demo accounts (tap to fill)
            </summary>
            <ul className="mt-3 space-y-1.5">
              {SEEDED_ACCOUNTS.map((u) => (
                <li key={u.code}>
                  <button
                    type="button"
                    onClick={() => quickFill(u.code, u.pwd)}
                    className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent as-press"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{u.name}</div>
                      <div className="text-[11px] text-muted-foreground">{u.role}</div>
                    </div>
                    <code className="text-[11px] font-mono text-brand">{u.code}</code>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
