import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { PageHeader } from "@/components/layout/PageHeader";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteChatMessage,
  editChatMessage,
  fetchChatMessages,
  fetchChatReactions,
  fetchChatReads,
  fetchProjectsMini,
  getSignedChatUrls,
  markChatRead,
  removeChatReaction,
  sendChatMessage,
  setChatReaction,
  uploadChatAttachment,
  type ChatAttachment,
} from "@/lib/project-actions";
import { gradientFromId } from "@/lib/project-mapper";
import { codeFromProjectId } from "@/lib/task-mapper";
import type { ChatMessage, ChatReaction } from "@/lib/types";
import { dateDividerLabel, relativeFromNow } from "@/lib/format";
import { playChatSound, vibrate } from "@/lib/feedback";
import {
  Check,
  CheckCheck,
  CornerUpLeft,
  Paperclip,
  Pencil,
  Send,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const TYPING_TIMEOUT_MS = 3000;

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { user, allUsers } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readSnapshotRef = useRef<Record<string, string | undefined>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "select"],
    queryFn: fetchProjectsMini,
  });
  const activeId = active ?? projects[0]?.id ?? null;

  // Reset per-conversation draft state when switching projects, so a reply/edit
  // in flight for one project's chat can't leak into another's.
  useEffect(() => {
    setText("");
    setFile(null);
    setReplyingTo(null);
    setEditingId(null);
    setReactionPickerFor(null);
  }, [activeId]);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-messages", activeId],
    queryFn: () => fetchChatMessages(activeId!),
    enabled: !!activeId,
  });
  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  // Kept in a ref (not a hook dependency) so the realtime channel effect below
  // doesn't tear down and resubscribe every time a new message arrives.
  const messageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    messageIdsRef.current = new Set(messageIds);
  }, [messageIds]);

  const { data: reads = [] } = useQuery({
    queryKey: ["chat-reads", activeId],
    queryFn: () => fetchChatReads(activeId!),
    enabled: !!activeId,
  });

  const { data: reactions = [] } = useQuery({
    queryKey: ["chat-reactions", activeId, messageIds],
    queryFn: () => fetchChatReactions(messageIds),
    enabled: messageIds.length > 0,
  });
  const reactionsByMessage = useMemo(() => {
    const map = new Map<string, ChatReaction[]>();
    for (const r of reactions) {
      const list = map.get(r.messageId) ?? [];
      list.push(r);
      map.set(r.messageId, list);
    }
    return map;
  }, [reactions]);

  // Snapshot "read up to" the first time we see it for a project, so the
  // unread divider doesn't vanish the instant we mark the chat as read.
  useEffect(() => {
    if (!activeId || !user) return;
    if (readSnapshotRef.current[activeId] !== undefined) return;
    const mine = reads.find((r) => r.userId === user.id);
    if (mine) readSnapshotRef.current[activeId] = mine.lastReadAt;
  }, [activeId, reads, user]);

  // Mark read whenever this chat is open and its messages change.
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    markChatRead(activeId).then(() => qc.invalidateQueries({ queryKey: ["chat-reads", activeId] }));
  }, [activeId, messages.length, qc]);

  const attachmentPaths = messages
    .map((m) => m.attachmentUrl)
    .filter((u): u is string => !!u);
  const { data: attachmentUrls = new Map<string, string>() } = useQuery({
    queryKey: ["chat-attachment-urls", attachmentPaths],
    queryFn: () => getSignedChatUrls(attachmentPaths),
    enabled: attachmentPaths.length > 0,
  });

  // Live message inserts/edits/deletes, read-receipt and reaction updates.
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `project_id=eq.${activeId}` },
        (payload) => {
          const row = payload.new as Record<string, string | null>;
          const incoming: ChatMessage = {
            id: row.id as string,
            projectId: row.project_id as string,
            userId: row.sender_id as string,
            text: row.message as string,
            at: row.created_at as string,
            attachmentUrl: row.attachment_url,
            attachmentType: row.attachment_type,
            attachmentName: row.attachment_name,
            replyToId: row.reply_to_id,
            editedAt: row.edited_at,
            deletedAt: row.deleted_at,
          };
          qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
            old.some((m) => m.id === incoming.id) ? old : [...old, incoming],
          );
          if (incoming.userId !== user?.id) {
            playChatSound();
            vibrate(15);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `project_id=eq.${activeId}` },
        (payload) => {
          const row = payload.new as Record<string, string | null>;
          qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
            old.map((m) =>
              m.id === row.id
                ? { ...m, text: row.message as string, editedAt: row.edited_at, deletedAt: row.deleted_at }
                : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_reads", filter: `project_id=eq.${activeId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-reads", activeId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_reactions" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { message_id?: string } | null;
          if (row?.message_id && messageIdsRef.current.has(row.message_id)) {
            qc.invalidateQueries({ queryKey: ["chat-reactions", activeId] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, qc, user?.id]);

  // Presence: who's online in this project's chat, and who's typing.
  useEffect(() => {
    if (!activeId || !user) return;
    const channel = supabase.channel(`chat-presence-${activeId}`, {
      config: { presence: { key: user.id } },
    });
    const sync = () => {
      const state = channel.presenceState<{ typing?: boolean }>();
      setOnlineUserIds(Object.keys(state));
      const typing = Object.entries(state)
        .filter(([id, metas]) => id !== user.id && metas.some((m) => m.typing))
        .map(([id]) => id);
      setTypingUserIds(typing);
    };
    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ typing: false });
      });
    presenceChannelRef.current = channel;
    return () => {
      presenceChannelRef.current = null;
      supabase.removeChannel(channel);
      setOnlineUserIds([]);
      setTypingUserIds([]);
    };
  }, [activeId, user]);

  const setTyping = (typing: boolean) => {
    void presenceChannelRef.current?.track({ typing });
  };

  const handleTextChange = (v: string) => {
    setText(v);
    if (!activeId) return;
    setTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false), TYPING_TIMEOUT_MS);
  };

  const send = useMutation({
    mutationFn: async () => {
      let attachment: ChatAttachment | null = null;
      if (file) attachment = await uploadChatAttachment(activeId!, file);
      return sendChatMessage(activeId!, text.trim(), attachment, replyingTo?.id ?? null);
    },
    onSuccess: (msg) => {
      qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
        old.some((m) => m.id === msg.id) ? old : [...old, msg],
      );
      setText("");
      setFile(null);
      setReplyingTo(null);
      setTyping(false);
    },
    onError: (e: Error) => toast.error(e.message || "Could not send message"),
  });

  const saveEdit = useMutation({
    mutationFn: (messageId: string) => editChatMessage(messageId, text.trim()),
    onSuccess: (_r, messageId) => {
      qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
        old.map((m) => (m.id === messageId ? { ...m, text: text.trim(), editedAt: new Date().toISOString() } : m)),
      );
      setEditingId(null);
      setText("");
    },
    onError: (e: Error) => toast.error(e.message || "Could not edit message"),
  });

  const remove = useMutation({
    mutationFn: (messageId: string) => deleteChatMessage(messageId),
    onSuccess: (_r, messageId) => {
      qc.setQueryData<ChatMessage[]>(["chat-messages", activeId], (old = []) =>
        old.map((m) => (m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m)),
      );
    },
    onError: (e: Error) => toast.error(e.message || "Could not delete message"),
  });

  const react = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const mine = reactionsByMessage.get(messageId)?.find((r) => r.userId === user?.id);
      if (mine?.emoji === emoji) return removeChatReaction(messageId);
      return setChatReaction(messageId, emoji);
    },
    onSuccess: () => {
      setReactionPickerFor(null);
      qc.invalidateQueries({ queryKey: ["chat-reactions", activeId] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not react"),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (editingId) {
      if (!text.trim()) return;
      saveEdit.mutate(editingId);
      return;
    }
    if ((!text.trim() && !file) || !activeId) return;
    send.mutate();
  };

  const startEdit = (m: ChatMessage) => {
    setReplyingTo(null);
    setEditingId(m.id);
    setText(m.text);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setText("");
  };
  const startReply = (m: ChatMessage) => {
    setEditingId(null);
    setReplyingTo(m);
  };

  // "Seen" status for the current user's own messages.
  const otherLastReadAt = reads
    .filter((r) => r.userId !== user?.id)
    .map((r) => new Date(r.lastReadAt).getTime());
  const maxOtherRead = otherLastReadAt.length > 0 ? Math.max(...otherLastReadAt) : 0;

  const unreadSnapshot = activeId ? readSnapshotRef.current[activeId] : undefined;

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
          <div className="flex-1 space-y-1 overflow-y-auto p-4">
            {messages.map((m, i) => {
              const u = allUsers.find((x) => x.id === m.userId);
              const mine = m.userId === user?.id;
              const prev = i > 0 ? messages[i - 1] : null;
              const isNewDay = !prev || dateDividerLabel(prev.at) !== dateDividerLabel(m.at);
              const isFirstInGroup =
                !prev ||
                isNewDay ||
                prev.userId !== m.userId ||
                new Date(m.at).getTime() - new Date(prev.at).getTime() > GROUP_WINDOW_MS;
              const showUnreadDivider =
                !!unreadSnapshot &&
                new Date(m.at).getTime() > new Date(unreadSnapshot).getTime() &&
                !(prev && new Date(prev.at).getTime() > new Date(unreadSnapshot).getTime());
              const repliedTo = m.replyToId ? messageById.get(m.replyToId) : null;
              const repliedToUser = repliedTo ? allUsers.find((x) => x.id === repliedTo.userId) : null;
              const msgReactions = reactionsByMessage.get(m.id) ?? [];
              const reactionCounts = new Map<string, number>();
              for (const r of msgReactions) reactionCounts.set(r.emoji, (reactionCounts.get(r.emoji) ?? 0) + 1);
              const myReaction = msgReactions.find((r) => r.userId === user?.id)?.emoji;
              const seen = mine && new Date(m.at).getTime() <= maxOtherRead;
              const isOnline = onlineUserIds.includes(m.userId);

              return (
                <div key={m.id}>
                  {isNewDay && (
                    <div className="my-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {dateDividerLabel(m.at)}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {showUnreadDivider && (
                    <div className="my-3 flex items-center gap-2">
                      <div className="h-px flex-1 bg-danger/40" />
                      <span className="text-[10px] uppercase tracking-wider text-danger">Unread</span>
                      <div className="h-px flex-1 bg-danger/40" />
                    </div>
                  )}
                  <div
                    className={
                      "group flex gap-3 " + (mine ? "flex-row-reverse" : "") + (isFirstInGroup ? " mt-2" : "")
                    }
                  >
                    <div className="w-8 shrink-0">
                      {u && isFirstInGroup && (
                        <div className="relative">
                          <UserAvatar user={u} size={32} />
                          {isOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-success ring-2 ring-card" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className={"max-w-[75%] " + (mine ? "items-end" : "items-start") + " flex flex-col"}>
                      <div
                        className={
                          "rounded-lg px-3 py-2 text-sm " +
                          (mine ? "bg-brand/20 text-foreground" : "bg-surface-2")
                        }
                      >
                        {isFirstInGroup && (
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {u?.name.split(" ")[0] ?? "Unknown"} · {relativeFromNow(m.at)}
                          </div>
                        )}
                        {m.deletedAt ? (
                          <div className="mt-0.5 italic text-muted-foreground">This message was deleted</div>
                        ) : (
                          <>
                            {repliedTo && (
                              <div className="mt-1 rounded-md border-l-2 border-brand/60 bg-black/10 px-2 py-1 text-xs text-muted-foreground">
                                <div className="font-medium text-foreground/80">
                                  {repliedToUser?.name.split(" ")[0] ?? "Unknown"}
                                </div>
                                <div className="truncate">{repliedTo.deletedAt ? "Message deleted" : repliedTo.text || "Attachment"}</div>
                              </div>
                            )}
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
                            {m.text && <div className="mt-0.5 whitespace-pre-wrap">{m.text}</div>}
                            {m.editedAt && (
                              <span className="text-[9px] text-muted-foreground">(edited)</span>
                            )}
                          </>
                        )}
                      </div>

                      {reactionCounts.size > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Array.from(reactionCounts.entries()).map(([emoji, count]) => (
                            <button
                              key={emoji}
                              onClick={() => react.mutate({ messageId: m.id, emoji })}
                              className={
                                "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs as-press " +
                                (myReaction === emoji
                                  ? "border-brand bg-brand/15"
                                  : "border-border bg-surface-2")
                              }
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] text-muted-foreground">{count}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {!m.deletedAt && (
                        <div className="mt-1 flex items-center gap-2 text-muted-foreground/70">
                          <button
                            onClick={() => setReactionPickerFor(reactionPickerFor === m.id ? null : m.id)}
                            aria-label="React"
                            className="hover:text-foreground"
                          >
                            <SmilePlus className="size-3.5" />
                          </button>
                          <button onClick={() => startReply(m)} aria-label="Reply" className="hover:text-foreground">
                            <CornerUpLeft className="size-3.5" />
                          </button>
                          {mine && (
                            <>
                              <button onClick={() => startEdit(m)} aria-label="Edit" className="hover:text-foreground">
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                onClick={() => remove.mutate(m.id)}
                                aria-label="Delete"
                                className="hover:text-danger"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                          {mine && (seen ? <CheckCheck className="size-3.5 text-brand" /> : <Check className="size-3.5" />)}
                        </div>
                      )}

                      {reactionPickerFor === m.id && (
                        <div className="mt-1 flex gap-1 rounded-full border border-border bg-card p-1 shadow-card">
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => react.mutate({ messageId: m.id, emoji })}
                              className="rounded-full p-1 text-base hover:bg-accent as-press"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {activeId && messages.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No messages yet — say hello.
              </div>
            )}
            {typingUserIds.length > 0 && (
              <div className="px-1 pt-1 text-xs italic text-muted-foreground">
                {typingUserIds
                  .map((id) => allUsers.find((u) => u.id === id)?.name.split(" ")[0])
                  .filter(Boolean)
                  .join(", ")}{" "}
                {typingUserIds.length === 1 ? "is" : "are"} typing…
              </div>
            )}
          </div>

          {(replyingTo || editingId) && (
            <div className="flex items-center justify-between border-t border-border bg-surface-2 px-3 py-2 text-xs">
              <span className="truncate">
                {editingId ? (
                  "Editing message"
                ) : (
                  <>
                    Replying to{" "}
                    <span className="font-medium text-foreground">
                      {allUsers.find((u) => u.id === replyingTo?.userId)?.name.split(" ")[0] ?? "Unknown"}
                    </span>
                    : {replyingTo?.text || "Attachment"}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => (editingId ? cancelEdit() : setReplyingTo(null))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
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
            {!editingId && (
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
            )}
            <Input
              className="h-11 flex-1 bg-surface-2"
              placeholder={editingId ? "Edit your message…" : "Type a message..."}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              disabled={!activeId}
            />
            <Button
              type="submit"
              size="icon"
              variant="brand"
              className="size-11 shrink-0"
              disabled={
                editingId
                  ? !text.trim() || saveEdit.isPending
                  : (!text.trim() && !file) || !activeId || send.isPending
              }
            >
              {editingId ? <Check className="size-4" /> : <Send className="size-4" />}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
