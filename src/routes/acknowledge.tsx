import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ACK_TEXT } from "@/lib/demo-data";
import { ROLE_LABEL } from "@/lib/types";
import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/acknowledge")({
  component: AckPage,
});

function AckPage() {
  const { user, acknowledge } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" />;
  if (user.acknowledged) return <Navigate to="/dashboard" />;

  const submit = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    try {
      await acknowledge();
      toast.success("Thank you — acknowledgement recorded.");
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-5 as-grain">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex justify-center">
          <Logo size={36} />
        </div>
        <div className="as-card-glass p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand">
            <ShieldCheck className="size-4" />
            First-login acknowledgement
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Welcome, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as <span className="text-foreground">{user.employeeCode}</span> ·{" "}
            {ROLE_LABEL[user.role]}
          </p>

          <div className="mt-6 rounded-lg border border-border bg-surface-2 p-5 text-sm leading-relaxed text-foreground/90">
            {ACK_TEXT}
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent">
            <Checkbox
              checked={agreed}
              onCheckedChange={(v) => setAgreed(Boolean(v))}
              className="mt-0.5"
            />
            <span className="text-sm">
              I have read and accept the AS Construction acknowledgement.
            </span>
          </label>

          <Button
            disabled={!agreed}
            onClick={submit}
            variant="brand"
            shape="pill"
            className="mt-5 h-11 w-full as-press"
          >
            <CheckCircle2 className="size-4" /> Accept & continue
          </Button>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Recorded against your employee code with date and time.
          </p>
        </div>
      </div>
    </div>
  );
}
