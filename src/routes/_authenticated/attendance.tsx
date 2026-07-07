import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/status-pill";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DEMO_ATTENDANCE, DEMO_PROJECTS, DEMO_USERS } from "@/lib/demo-data";
import { formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  return (
    <>
      <PageHeader title="Attendance & Time Logs" subtitle="Today's clock-ins, breaks and hours." />
      <div className="as-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Worker</th>
              <th className="p-3 text-left">Site</th>
              <th className="p-3 text-left">Clock-in</th>
              <th className="p-3 text-left">Clock-out</th>
              <th className="p-3 text-left">Break</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ATTENDANCE.map((a) => {
              const u = DEMO_USERS.find((x) => x.id === a.userId);
              const p = DEMO_PROJECTS.find((x) => x.id === a.projectId);
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {u && <UserAvatar user={u} size={28} />}
                      <div>
                        <div className="font-medium">{u?.name}</div>
                        <div className="text-[11px] text-muted-foreground">{u?.employeeCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{p?.name ?? "—"}</td>
                  <td className="p-3">{formatTime(a.clockIn)}</td>
                  <td className="p-3">{a.clockOut ? formatTime(a.clockOut) : <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">{a.breakMinutes}m</td>
                  <td className="p-3">
                    <Pill tone={a.status === "Active" ? "success" : a.status === "On Break" ? "warning" : "neutral"}>
                      {a.status}
                    </Pill>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
