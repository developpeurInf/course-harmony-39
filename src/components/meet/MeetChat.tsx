"use client";

/**
 * Chat de la réunion : messages gardés dans la base (meeting_messages, visibles après la réunion)
 * et livrés instantanément aux présents par le canal de données LiveKit (sujet « chat »).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquareOff, SendHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { deleteMessage, initials, personHue, sendMessage, type MeetMessage } from "@/lib/meet";
import type { Tr } from "./useTr";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function MeetChat(props: {
  tr: Tr;
  locale: string;
  meetingId: string;
  me: string;
  hostId: string;
  isHost: boolean;
  chatOpen: boolean;
  messages: MeetMessage[] | null;
  names: Record<string, string>;
  onLocal: (m: MeetMessage) => void;
  onSent: (temp: string, m: MeetMessage | null) => void;
  onDeleted: (id: string) => void;
  broadcast: (topic: string, payload: unknown) => void;
}) {
  const { tr, locale } = props;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canWrite = props.isHost || props.chatOpen;

  const visible = useMemo(() => (props.messages || []).filter(m => !m.deleted_at), [props.messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom || visible[visible.length - 1]?.sender_id === props.me) el.scrollTop = el.scrollHeight;
  }, [visible, props.me]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || !canWrite) return;
    const clientId = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const temp: MeetMessage = {
      id: clientId,
      meeting_id: props.meetingId,
      sender_id: props.me,
      body,
      client_id: clientId,
      created_at: new Date().toISOString(),
      deleted_at: null,
      _pending: true,
    };
    props.onLocal(temp);
    setText("");
    setSending(true);
    try {
      const saved = await sendMessage(props.meetingId, props.me, body, clientId);
      props.onSent(clientId, saved);
      props.broadcast("chat", saved);
    } catch (e: any) {
      props.onSent(clientId, null);
      setText(body);
      toast.error(
        e?.code === "42501"
          ? tr("Le chat est fermé par le professeur.", "أغلق الأستاذ الدردشة.", "The teacher closed the chat.")
          : tr("Message non envoyé.", "لم يتم إرسال الرسالة.", "Message not sent."),
      );
    } finally {
      setSending(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  };

  const remove = async (m: MeetMessage) => {
    try {
      await deleteMessage(m.id);
      props.onDeleted(m.id);
      props.broadcast("chat-delete", { id: m.id });
    } catch {
      toast.error(tr("Suppression impossible.", "تعذر الحذف.", "Could not delete."));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={listRef} className="meet-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {props.messages === null ? (
          <div className="flex h-full items-center justify-center text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white/50">
            <span className="text-3xl" aria-hidden="true">
              💬
            </span>
            <p className="font-medium text-white/70">{tr("Aucun message pour l'instant", "لا توجد رسائل بعد", "No messages yet")}</p>
            <p className="text-xs">
              {tr(
                "Les messages restent visibles par la classe après la réunion.",
                "تبقى الرسائل مرئية للقسم بعد الاجتماع.",
                "Messages stay visible to the class after the meeting.",
              )}
            </p>
          </div>
        ) : (
          visible.map((m, i) => {
            const prev = visible[i - 1];
            const grouped = prev && prev.sender_id === m.sender_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 3 * 60_000;
            const mine = m.sender_id === props.me;
            const fromHost = m.sender_id === props.hostId;
            const name = mine ? tr("Vous", "أنت", "You") : props.names[m.sender_id] || tr("Participant", "مشارك", "Participant");
            return (
              <div key={m.id} className={cn("group flex gap-2.5", grouped ? "mt-0.5" : "mt-3")}>
                <div className="w-8 shrink-0">
                  {!grouped && (
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
                      style={{ background: `hsl(${personHue(m.sender_id)} 55% 45%)` }}
                    >
                      {initials(props.names[m.sender_id] || name)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className={cn("truncate text-[13px] font-semibold", fromHost ? "text-amber-300" : "text-white/90")}>{name}</span>
                      {fromHost && (
                        <span className="rounded bg-amber-400/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          {tr("Prof", "أستاذ", "Teacher")}
                        </span>
                      )}
                      <span className="text-[11px] text-white/40">{new Date(m.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-1">
                    <p
                      dir="auto"
                      className={cn(
                        "min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85",
                        m._pending && "opacity-60",
                        fromHost && "text-white",
                      )}
                    >
                      <Linkified text={m.body} />
                    </p>
                    {(mine || props.isHost) && !m._pending && (
                      <button
                        type="button"
                        onClick={() => void remove(m)}
                        className="ms-auto shrink-0 rounded p-1 text-white/0 transition group-hover:text-white/40 hover:!text-rose-300 focus-visible:text-white/60"
                        aria-label={tr("Supprimer le message", "حذف الرسالة", "Delete message")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        {canWrite ? (
          <div className="flex items-end gap-2 rounded-2xl bg-white/5 p-1.5 ring-1 ring-white/10 focus-within:ring-primary/60">
            <textarea
              ref={inputRef}
              dir="auto"
              rows={1}
              value={text}
              maxLength={4000}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={tr("Écrire à toute la classe…", "اكتب للقسم كله…", "Message the whole class…")}
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!text.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition disabled:opacity-30"
              aria-label={tr("Envoyer", "إرسال", "Send")}
            >
              <SendHorizontal className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/60">
            <MessageSquareOff className="h-4 w-4" />
            {tr("Le professeur a fermé le chat.", "أغلق الأستاذ الدردشة.", "The teacher turned off chat.")}
          </p>
        )}
      </div>
    </div>
  );
}
