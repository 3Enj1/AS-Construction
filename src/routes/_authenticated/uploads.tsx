import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { Camera, ImageIcon, Upload as UploadIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/uploads")({
  component: UploadsPage,
});

const RECENT_UPLOADS = [
  { name: "Foundation pour — before.jpg", date: "2026-07-12", size: "2.4 MB", hue: 27 },
  { name: "Slab curing progress.jpg", date: "2026-07-11", size: "1.8 MB", hue: 57 },
  { name: "Brickwork north wall.jpg", date: "2026-07-10", size: "3.1 MB", hue: 87 },
  { name: "Electrical rough-in.jpg", date: "2026-07-09", size: "2.0 MB", hue: 117 },
  { name: "Roof trusses installed.jpg", date: "2026-07-08", size: "2.7 MB", hue: 147 },
  { name: "Plumbing inspection.jpg", date: "2026-07-06", size: "1.5 MB", hue: 177 },
  { name: "Drywall completion.jpg", date: "2026-07-04", size: "2.2 MB", hue: 207 },
  { name: "Site cleanup — final.jpg", date: "2026-07-02", size: "1.9 MB", hue: 237 },
];

function UploadsPage() {
  return (
    <>
      <PageHeader
        title="Uploads / Updates"
        subtitle="Add before/progress/completion photos with a quick note."
      />
      <div className="as-card p-6 text-center">
        <UploadIcon className="mx-auto size-7 text-brand" />
        <h3 className="mt-3 font-semibold">Quick photo upload</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the camera below to take and attach a site photo.
        </p>
        <Button variant="brand" shape="pill" className="mt-4 h-12">
          <Camera className="size-4" /> Take photo
        </Button>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Recent uploads
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {RECENT_UPLOADS.map((file) => (
          <div
            key={file.name}
            className="as-card as-press overflow-hidden hover:border-brand/40 hover:shadow-glow-brand"
          >
            <div
              className="grid aspect-square place-items-center"
              style={{
                background: `linear-gradient(135deg, oklch(0.3 0.05 ${file.hue}), oklch(0.18 0.02 270))`,
              }}
            >
              <ImageIcon className="size-6 text-foreground/70" />
            </div>
            <div className="p-2.5">
              <div className="truncate text-xs font-medium text-foreground">{file.name}</div>
              <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{formatDate(file.date)}</span>
                <span>{file.size}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
