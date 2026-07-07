import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { mapDbProject, type DbProject } from "@/lib/project-mapper";
import { createProjectFromTemplate } from "@/lib/project-actions";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsList,
});

type StatusValue = "planning" | "active" | "on_hold" | "completed" | "cancelled";

function ProjectsList() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,project_name,client_name,site_address,status,start_date,expected_completion_date,assigned_project_manager_id,assigned_site_supervisor_id",
        )
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as DbProject[]) ?? []).map(mapDbProject);
    },
  });

  const filtered = projects.filter((p) =>
    (p.name + p.code + p.client + p.address).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={`${filtered.length} project${filtered.length === 1 ? "" : "s"} across all sites`}
        actions={
          hasRole("admin", "project_manager") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-brand text-brand-foreground hover:bg-brand/90">
                  <Plus className="size-4" /> New project
                </Button>
              </DialogTrigger>
              <NewProjectDialog
                onCreated={() => {
                  setOpen(false);
                  qc.invalidateQueries({ queryKey: ["projects"] });
                  qc.invalidateQueries({ queryKey: ["tasks"] });
                }}
              />
            </Dialog>
          )
        }
      />
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search projects, addresses, clients..."
          className="pl-9 h-11"
        />
      </div>
      {isLoading ? (
        <div className="as-card p-6 text-sm text-muted-foreground">Loading projects…</div>
      ) : filtered.length === 0 ? (
        <div className="as-card p-6 text-sm text-muted-foreground">
          {projects.length === 0
            ? "No projects yet. Click \"New project\" to create one."
            : "No projects match your search."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </>
  );
}

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<StatusValue>("planning");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [templateId, setTemplateId] = useState<string>("none");

  const { data: templates = [] } = useQuery({
    queryKey: ["project-templates", "select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_templates")
        .select("id,template_name")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return (data ?? []) as { id: string; template_name: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      return createProjectFromTemplate({
        project_name: name.trim(),
        client_name: client.trim() || null,
        site_address: address.trim() || null,
        description: description.trim() || null,
        status,
        start_date: startDate || null,
        expected_completion_date: targetDate || null,
        template_id: templateId === "none" ? null : templateId,
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.tasks > 0
          ? `Project created with ${res.phases} phases and ${res.tasks} tasks`
          : "Project created",
      );
      onCreated();
      navigate({ to: "/projects/$id", params: { id: res.projectId } });
    },
    onError: (e: Error) => toast.error(e.message || "Could not create project"),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="np-name">Project name</Label>
          <Input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stuart Residence — Bryanston" />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="np-client">Client</Label>
            <Input id="np-client" value={client} onChange={(e) => setClient(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusValue)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="np-addr">Site address</Label>
          <Input id="np-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="np-start">Start date</Label>
            <Input id="np-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="np-target">Target completion</Label>
            <Input id="np-target" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Template (optional)</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger><SelectValue placeholder="None — start blank" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None — start blank</SelectItem>
              {templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>{tpl.template_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Choosing a template auto-generates phases and tasks.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="np-desc">Description</Label>
          <Textarea id="np-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button
          className="bg-brand text-brand-foreground hover:bg-brand/90"
          disabled={!name.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Creating…" : "Create project"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

