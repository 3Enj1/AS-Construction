import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="System & company configuration." />
      <div className="as-card p-8 text-center">
        <SettingsIcon className="mx-auto size-8 text-muted-foreground" />
        <h3 className="mt-3 font-medium">Settings module coming soon</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Company profile, project defaults, branding, notification rules and role permissions will live here.
        </p>
      </div>
    </>
  );
}
