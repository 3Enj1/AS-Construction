import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchChatMessages,
  fetchProjectsMini,
  getSignedChatUrls,
  sendChatMessage,
  uploadChatAttachment,
  type ChatAttachment,
} from "@/lib/project-actions";
import { gradientFromId } from "@/lib/project-mapper";
import { codeFromProjectId } from "@/lib/task-mapper";
import type { ChatMessage } from "@/lib/types";
import { relativeFromNow } from "@/lib/format";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { user, allUsers } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const attachmentPaths = messages
    .map((m) => m.attachmentUrl)
    .filter((u): u is string => !!u);
  const { data: attachmentUrls = new Map<string, string>() } = useQuery({
    queryKey: ["chat-attachment-urls", attachmentPaths],
    queryFn: () => getSignedChatUrls(attachmentPaths),
    enabled: attachmentPaths.length > 0,
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
            attachment_url: string | null;
            attachment_type: string | null;
            attachment_name: string | null;
          };
          const incoming: ChatMessage = {
            id: row.id,
            projectId: row.project_id,
            userId: row.sender_id,
            text: row.message,
            at: row.created_at,
            attachmentUrl: row.attachment_url,
            attachmentType: row.attachment_type,
            attachmentName: row.attachment_name,
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
    mutationFn: async () => {
      let attachment: ChatAttachment | null = null;
      if (file) attachment = await uploadChatAttachment(activeId!, file);
      return sendChatMessage(activeId!, text.trim(), attachment);
    },
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
        old.some((m) => m.id === msg.id) ? old : [...old, msg],
      );
      setText("");
      setFile(null);
    },
    onError: (e: Error) => toast.error(e.message || "Could not send message"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if ((!text.trim() && !file) || !activeId) return;
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
                    {m.attachmentUrl && (
                      m.attachmentType?.startsWith("image/") ? (
                        <a href={attachmentUrls.get(m.attachmentUrl)} target="_blank" rel="noreferrer">
                          <img
                            src={attachmentUrls.get(m.attachmentUrl)}
                            alt={m.attachmentName ?? "Attachment"}
                            className="mt-1 max-h-48 rounded-md object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={attachmentUrls.get(m.attachmentUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1.5 text-xs underline"
                        >
                          <Paperclip className="size-3.5" /> {m.attachmentName ?? "Attachment"}
                        </a>
                      )
                    )}
                    {m.text && <div className="mt-0.5">{m.text}</div>}
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
          {file && (
            <div className="flex items-center justify-between border-t border-border bg-surface-2 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 truncate">
                <Paperclip className="size-3.5" /> {file.name}
              </span>
              <button type="button" onClick={() => setFile(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          )}
          <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-11 shrink-0"
              disabled={!activeId}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-4" />
            </Button>
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
              className="size-11 shrink-0"
              disabled={(!text.trim() && !file) || !activeId || send.isPending}
            >
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
