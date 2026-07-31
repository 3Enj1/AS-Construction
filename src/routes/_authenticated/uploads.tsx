import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import {
  fetchMyUploads,
  fetchProjectsMini,
  getSignedPhotoUrls,
  uploadTaskPhoto,
} from "@/lib/project-actions";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Camera, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/uploads")({
  component: UploadsPage,
});

const CATEGORIES = [
  { value: "before", label: "Before" },
  { value: "progress", label: "Progress" },
  { value: "completion", label: "Completion" },
  { value: "other", label: "Other" },
];

function UploadsPage() {
  const { hasRole } = useAuth();
  const canUpload = !hasRole("client");
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("progress");
  const [note, setNote] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
    enabled: canUpload,
  });

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["my-uploads"],
    queryFn: fetchMyUploads,
  });

  const { data: signedUrls = new Map<string, string>() } = useQuery({
    queryKey: ["upload-signed-urls", uploads.map((u) => u.fileUrl)],
    queryFn: () => getSignedPhotoUrls(uploads.map((u) => u.fileUrl)),
    enabled: uploads.length > 0,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!projectId) throw new Error("Choose a project first");
      return uploadTaskPhoto({ projectId, file, category, note: note || null });
    },
    onSuccess: () => {
      toast.success("Photo uploaded");
      setNote("");
      qc.invalidateQueries({ queryKey: ["my-uploads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Uploads / Updates"
        subtitle="Add before/progress/completion photos with a quick note."
      />

      {canUpload && (
        <div className="as-card p-6">
          <div className="mx-auto max-w-sm text-center">
            <Camera className="mx-auto size-7 text-brand" />
            <h3 className="mt-3 font-semibold">Quick photo upload</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a project and category, then take or choose a photo.
            </p>
          </div>
          <div className="mx-auto mt-4 grid max-w-sm gap-3">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              rows={2}
              placeholder="Optional note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="brand"
              shape="pill"
              className="h-12"
              disabled={!projectId || upload.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="size-4" /> {upload.isPending ? "Uploading…" : "Take / choose photo"}
            </Button>
          </div>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Recent uploads
      </h2>
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading uploads…</div>
      ) : uploads.length === 0 ? (
        <div className="as-card p-8 text-center text-sm text-muted-foreground">
          <ImageIcon className="mx-auto mb-2 size-6" />
          No photos uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {uploads.map((u) => {
            const src = signedUrls.get(u.fileUrl);
            return (
              <div
                key={u.id}
                className="as-card overflow-hidden hover:border-brand/40 hover:shadow-glow-brand"
              >
                <div className="grid aspect-square place-items-center overflow-hidden bg-surface-2">
                  {src ? (
                    <img src={src} alt={u.note ?? u.projectName} className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-xs font-medium text-foreground">
                    {u.projectName}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="capitalize">{u.category}</span>
                    <span>{formatDate(u.createdAt)}</span>
                  </div>
                  {u.note && (
                    <div className="mt-1 truncate text-[10px] text-muted-foreground">{u.note}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
