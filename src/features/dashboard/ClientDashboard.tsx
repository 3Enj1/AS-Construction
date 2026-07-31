import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { supabase } from "@/integrations/supabase/client";
import { attachProjectProgress, currentProfileId } from "@/lib/project-actions";
import { mapDbProject, type DbProject } from "@/lib/project-mapper";

export function ClientDashboard() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["client-projects"],
    queryFn: async () => {
      const meId = await currentProfileId();
      if (!meId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,project_name,client_name,site_address,status,start_date,expected_completion_date,assigned_project_manager_id,assigned_site_supervisor_id",
        )
        .eq("client_profile_id", meId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return attachProjectProgress(((data as DbProject[]) ?? []).map(mapDbProject));
    },
  });

  const { data: latestUpdate } = useQuery({
    queryKey: ["client-latest-update"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("title,body,created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { title: string; body: string; created_at: string } | null;
    },
  });

  return (
    <>
      <PageHeader title="My project" subtitle="Approved progress updates from your build team." />
      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <div className="as-card p-5 text-sm text-muted-foreground">Loading your project…</div>
        ) : projects.length === 0 ? (
          <div className="as-card p-5 text-sm text-muted-foreground">
            No project assigned to your account yet.
          </div>
        ) : (
          projects.map((p) => <ProjectCard key={p.id} project={p} />)
        )}
      </div>
      <div className="mt-8 as-card p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Latest update
        </h3>
        <p className="mt-3 text-sm leading-relaxed">
          {latestUpdate ? latestUpdate.body : "No updates yet."}
        </p>
      </div>
    </>
  );
}
