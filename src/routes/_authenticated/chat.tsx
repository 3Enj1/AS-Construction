import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchChatMessages, fetchProjectsMini, sendChatMessage } from "@/lib/project-actions";
import { gradientFromId } from "@/lib/project-mapper";
import { codeFromProjectId } from "@/lib/task-mapper";
import type { ChatMessage } from "@/lib/types";
import { relativeFromNow } from "@/lib/format";
import { Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { user, allUsers } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
  });
  const activeId = active ?? projects[0]?.id ?? null;

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", activeId],
    queryFn: () => fetchChatMessages(activeId!),
    enabled: !!activeId,
  });

  // Live updates: append new messages pushed from Supabase Realtime for the active project.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `project_id=eq.${activeId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            project_id: string;
            sender_id: string;
            message: string;
            created_at: string;
          };
          const incoming: ChatMessage = {
            id: row.id,
            projectId: row.project_id,
            userId: row.sender_id,
            text: row.message,
            at: row.created_at,
          };
          qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
            old.some((m) => m.id === incoming.id) ? old : [...old, incoming],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, qc]);

  const send = useMutation({
    mutationFn: () => sendChatMessage(activeId!, text.trim()),
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
        old.some((m) => m.id === msg.id) ? old : [...old, msg],
      );
      setText("");
    },
    onError: (e: Error) => toast.error(e.message || "Could not send message"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    send.mutate();
  };

  return (
    <>
      <PageHeader title="Project Chat" subtitle="Per-project conversations with your team." />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="as-card divide-y divide-border lg:max-h-[600px] lg:overflow-y-auto">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={
                "flex w-full items-start gap-3 p-3 text-left hover:bg-accent as-press " +
                (activeId === p.id ? "bg-brand/10" : "")
              }
            >
              <div className="size-9 rounded-md" style={{ background: gradientFromId(p.id) }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.project_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {codeFromProjectId(p.id)}
                </div>
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No projects to chat about yet.</div>
          )}
        </div>

        <div className="as-card flex h-[600px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => {
              const u = allUsers.find((x) => x.id === m.userId);
              const mine = m.userId === user?.id;
              return (
                <div key={m.id} className={"flex gap-3 " + (mine ? "flex-row-reverse" : "")}>
                  {u && <UserAvatar user={u} size={32} />}
                  <div
                    className={
                      "max-w-[75%] rounded-lg px-3 py-2 text-sm " +
                      (mine ? "bg-brand/20 text-foreground" : "bg-surface-2")
                    }
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {u?.name.split(" ")[0] ?? "Unknown"} · {relativeFromNow(m.at)}
                    </div>
                    <div className="mt-0.5">{m.text}</div>
                  </div>
                </div>
              );
            })}
            {activeId && messages.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No messages yet — say hello.
              </div>
            )}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
            <input
              className="flex-1 h-11 rounded-md bg-surface-2 border border-border px-3 text-sm"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!activeId}
            />
            <Button
              type="submit"
              size="icon"
              variant="brand"
              className="size-11"
              disabled={!text.trim() || !activeId || send.isPending}
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
