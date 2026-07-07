import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Camera, Upload as UploadIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/uploads")({
  component: UploadsPage,
});

function UploadsPage() {
  return (
    <>
      <PageHeader title="Uploads / Updates" subtitle="Add before/progress/completion photos with a quick note." />
      <div className="as-card p-6 text-center">
        <UploadIcon className="mx-auto size-7 text-brand" />
        <h3 className="mt-3 font-semibold">Quick photo upload</h3>
        <p className="mt-1 text-sm text-muted-foreground">Tap the camera below to take and attach a site photo.</p>
        <Button className="mt-4 h-12 bg-brand text-brand-foreground hover:bg-brand/90"><Camera className="size-4" /> Take photo</Button>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent uploads</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="as-card aspect-square overflow-hidden">
            <div className="h-full w-full" style={{
              background: `linear-gradient(135deg, oklch(0.3 0.05 ${27 + i * 30}), oklch(0.18 0.02 270))`,
            }} />
          </div>
        ))}
      </div>
    </>
  );
}
