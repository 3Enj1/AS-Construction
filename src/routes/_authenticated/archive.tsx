import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/_authenticated/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  return (
    <>
      <PageHeader title="Archive" subtitle="Completed projects, closed tasks and historical records." />
      <div className="as-card p-8 text-center">
        <Archive className="mx-auto size-8 text-muted-foreground" />
        <h3 className="mt-3 font-medium">Nothing archived yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Completed projects and closed tasks will appear here automatically.
        </p>
      </div>
    </>
  );
}
