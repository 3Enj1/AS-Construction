import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { DEMO_CHAT, DEMO_PROJECTS, DEMO_USERS } from "@/lib/demo-data";
import { relativeFromNow } from "@/lib/format";
import { Send } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  const [active, setActive] = useState(DEMO_PROJECTS[0].id);
  const { user } = useAuth();
  const messages = DEMO_CHAT.filter((c) => c.projectId === active);

  return (
    <>
      <PageHeader title="Project Chat" subtitle="Per-project conversations with your team." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="as-card divide-y divide-border lg:max-h-[600px] lg:overflow-y-auto">
          {DEMO_PROJECTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={
                "flex w-full items-start gap-3 p-3 text-left hover:bg-accent as-press " +
                (active === p.id ? "bg-brand/10" : "")
              }
            >
              <div className="size-9 rounded-md" style={{ background: p.coverGradient }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">{p.code}</div>
              </div>
              <span className="size-2 rounded-full bg-brand" />
            </button>
          ))}
        </div>

        <div className="as-card flex h-[600px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => {
              const u = DEMO_USERS.find((x) => x.id === m.userId)!;
              const mine = u.id === user?.id;
              return (
                <div key={m.id} className={"flex gap-3 " + (mine ? "flex-row-reverse" : "")}>
                  <UserAvatar user={u} size={32} />
                  <div className={"max-w-[75%] rounded-lg px-3 py-2 text-sm " + (mine ? "bg-brand/20 text-foreground" : "bg-surface-2")}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{u.name.split(" ")[0]} · {relativeFromNow(m.at)}</div>
                    <div className="mt-0.5">{m.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-3">
            <input className="flex-1 h-11 rounded-md bg-surface-2 border border-border px-3 text-sm" placeholder="Type a message..." />
            <Button size="icon" className="size-11 bg-brand text-brand-foreground"><Send className="size-4" /></Button>
          </div>
        </div>
      </div>
    </>
  );
}
