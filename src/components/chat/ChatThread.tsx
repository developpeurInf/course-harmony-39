"use client";

/** Fil d'une discussion élève ↔ professeur */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle, ArrowDown, BellOff, Bell, Check, CheckCheck, ChevronLeft, ChevronRight, Clock, Copy, Download, Loader2, Lock,
  LockOpen, MoreVertical, Pencil, Phone, Reply, ShieldCheck, Smile, Trash2, X,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useChat } from "@/contexts/ChatContext";
import { openChannel } from "@/lib/chatRealtime";
import {
  CHAT_BUCKET, MSG_COLUMNS, QUICK_REACTIONS, attachmentKind, db, fetchMessages, isOnline, signChatPaths, uploadChatFiles, uuid,
  type Attachment, type ChatContact, type ChatMessage, type MessageKind, type Reaction,
} from "@/lib/chat";
import { ChatAvatar } from "./ChatAvatar";
import { ChatComposer, type Activity, type Outgoing } from "./ChatComposer";
import { CallLine, ContactCard, FileCard, Linkified, LocationCard, MediaGrid, VoicePlayer } from "./MessageParts";

type Tr = (fr: string, ar: string, en: string) => string;

const CHAT_BG = {
  backgroundImage: "radial-gradient(hsl(var(--primary) / 0.08) 1px, transparent 1px)",
  backgroundSize: "20px 20px",
};

const GROUP_GAP = 3 * 60 * 1000;

export function ChatThread({ contact, me, isTeacher, tr, locale, onBack }: {
  contact: ChatContact & { conversation_id: string };
  me: string;
  isTeacher: boolean;
  tr: Tr;
  locale: string;
  onBack: () => void;
}) {
  const conv = contact.conversation_id;
  const { startCall, call, refresh } = useChat();
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [peer, setPeer] = useState<{ activity: Activity; at: number }>({ activity: "idle", at: 0 });
  const [peerHere, setPeerHere] = useState(false);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [viewer, setViewer] = useState<{ items: Attachment[]; index: number } | null>(null);
  const [newBelow, setNewBelow] = useState(0);
  const [firstUnreadAt] = useState<string | null>(contact.unread > 0 ? "pending" : null);
  const unreadMarker = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const keepOffset = useRef<number | null>(null);
  const atBottom = useRef(true);
  const outbox = useRef<Record<string, Outgoing>>({});
  const signalCh = useRef<{ channel: any; close: () => void } | null>(null);
  const [now, setNow] = useState(Date.now());

  const canWrite = contact.can_chat && (isTeacher || !contact.closed);

  // ------------------------------------------------------------ chargement
  const sign = useCallback(async (list: ChatMessage[]) => {
    const paths = list.flatMap(m => (m.attachments || []).map(a => a.path)).filter(p => !p.startsWith("local:"));
    if (!paths.length) return;
    const got = await signChatPaths(paths);
    setUrls(u => ({ ...u, ...got }));
  }, []);

  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await db.from("chat_reactions").select("message_id, user_id, emoji").in("message_id", ids);
    setReactions(prev => {
      const next = { ...prev };
      ids.forEach(id => { next[id] = []; });
      (data || []).forEach((r: Reaction) => { (next[r.message_id] ||= []).push(r); });
      return next;
    });
  }, []);

  const markRead = useCallback(() => {
    if (document.visibilityState === "hidden") return;
    void db.rpc("chat_mark_read", { p_conv: conv }).then(() => refresh());
  }, [conv, refresh]);

  /** Fusion : remplace le brouillon local (client_id) ou la version précédente (id) */
  const merge = useCallback((incoming: ChatMessage[]) => {
    setMsgs(prev => {
      const list = [...(prev || [])];
      incoming.forEach(m => {
        const i = list.findIndex(x => x.id === m.id || (m.client_id && x.client_id === m.client_id));
        if (i >= 0) list[i] = { ...m };
        else list.push(m);
      });
      return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  useEffect(() => {
    let alive = true;
    setMsgs(null);
    setHasMore(true);
    setSelected(null);
    setReplyTo(null);
    setEditing(null);
    fetchMessages(conv).then(list => {
      if (!alive) return;
      // Repère « nouveaux messages » : premier message reçu après ma dernière lecture
      if (firstUnreadAt && contact.unread > 0) {
        const theirs = list.filter(m => m.sender_id !== me);
        unreadMarker.current = theirs[Math.max(0, theirs.length - contact.unread)]?.id || null;
      }
      setMsgs(list);
      setHasMore(list.length >= 40);
      void sign(list);
      void loadReactions(list.map(m => m.id));
      markRead();
    }).catch(e => { if (alive) { setMsgs([]); toast.error(e.message); } });

    // Nouveaux messages, modifications, suppressions
    const ch = supabase.channel(`chat-msg-${conv}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conv}` }, (p: any) => {
        const m = p.new as ChatMessage;
        merge([m]);
        void sign([m]);
        if (m.sender_id !== me) {
          setPeer({ activity: "idle", at: 0 });
          if (atBottom.current) markRead(); else setNewBelow(n => n + 1);
        }
      })
      .on("postgres_changes" as any, { event: "UPDATE", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conv}` }, (p: any) => merge([p.new as ChatMessage]))
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "chat_reactions" }, (p: any) => {
        const id = (p.new?.message_id || p.old?.message_id) as string | undefined;
        if (id) void loadReactions([id]);
        else setMsgs(cur => { void loadReactions((cur || []).slice(-60).map(m => m.id)); return cur; });
      })
      .subscribe();

    // « écrit… », « enregistre… », présence dans la discussion
    let closed = false;
    void openChannel(`chat:${conv}`, c => {
      c.on("broadcast", { event: "activity" }, ({ payload }: any) => {
        if (payload?.from && payload.from !== me) setPeer({ activity: payload.a, at: Date.now() });
      });
      c.on("presence", { event: "sync" }, () => {
        const state = c.presenceState() as Record<string, unknown[]>;
        setPeerHere(Object.keys(state).some(k => k === contact.user_id));
      });
    }, { presenceKey: me }).then(s => {
      if (closed) { s.close(); return; }
      signalCh.current = s;
      try { void s.channel.track({ at: Date.now() }); } catch { /* ignore */ }
    });

    const onVis = () => { if (document.visibilityState === "visible") markRead(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      closed = true;
      void supabase.removeChannel(ch);
      signalCh.current?.close();
      signalCh.current = null;
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv]);

  // L'indicateur « écrit… » s'éteint seul après 6 s sans nouvelle
  useEffect(() => {
    if (peer.activity === "idle") return;
    const t = setTimeout(() => setPeer({ activity: "idle", at: 0 }), 6000);
    return () => clearTimeout(t);
  }, [peer]);

  // « vu il y a … » se met à jour
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const sendActivity = useCallback((a: Activity) => {
    try { void signalCh.current?.channel.send({ type: "broadcast", event: "activity", payload: { from: me, a } }); } catch { /* ignore */ }
  }, [me]);

  // ------------------------------------------------------------ défilement
  const scrollToBottom = (smooth = false) => {
    const el = scroller.current;
    if (!el) return;
    try { el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" }); } catch { el.scrollTop = el.scrollHeight; }
    setNewBelow(0);
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !msgs) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
      return;
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  // Repère des non-lus visible à l'ouverture
  useEffect(() => {
    if (!msgs || !unreadMarker.current) return;
    const node = document.getElementById(`msg-${unreadMarker.current}`);
    if (node) { node.scrollIntoView({ block: "center" }); atBottom.current = false; }
  }, [msgs === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = async () => {
    if (!msgs?.length || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const older = await fetchMessages(conv, msgs[0].created_at);
      const el = scroller.current;
      if (el) keepOffset.current = el.scrollHeight - el.scrollTop;
      setHasMore(older.length >= 40);
      setMsgs(prev => [...older, ...(prev || [])]);
      void sign(older);
      void loadReactions(older.map(m => m.id));
    } finally {
      setLoadingOlder(false);
    }
  };

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (bottom && !atBottom.current) { setNewBelow(0); markRead(); }
    atBottom.current = bottom;
    if (el.scrollTop < 120) void loadOlder();
  };

  // ------------------------------------------------------------ envoi
  const kindOf = (o: Outgoing): MessageKind => {
    if (o.voice) return "voice";
    if (o.contact) return "contact";
    if (o.files.length) return o.files.every(f => ["image", "video"].includes(attachmentKind(f.type))) ? "media" : "file";
    if (o.location && !o.text) return "location";
    return "text";
  };

  const deliver = async (clientId: string) => {
    const o = outbox.current[clientId];
    if (!o) return;
    const fileList = o.voice ? [o.voice.file] : o.files;
    let attachments: Attachment[] = [];
    if (fileList.length) {
      sendActivity(o.voice ? "idle" : "uploading");
      const { done, failed } = await uploadChatFiles(conv, fileList, o.voice ? { duration: o.voice.duration } : {});
      sendActivity("idle");
      if (failed.length) toast.error(tr(`Non envoyé : ${failed.join(", ")}`, `لم يُرسل: ${failed.join(", ")}`, `Not sent: ${failed.join(", ")}`));
      if (!done.length && !o.text && !o.location && !o.contact) {
        setMsgs(prev => (prev || []).map(m => (m.client_id === clientId ? { ...m, _pending: false, _failed: true } : m)));
        return;
      }
      attachments = done;
    }
    const { data, error } = await db.from("chat_messages").insert({
      conversation_id: conv, sender_id: me, kind: kindOf(o), body: o.text, attachments,
      location: o.location || null, contact: o.contact || null,
      reply_to: (o as any).reply_to || null, client_id: clientId,
    }).select(MSG_COLUMNS).single();
    if (error) {
      setMsgs(prev => (prev || []).map(m => (m.client_id === clientId ? { ...m, _pending: false, _failed: true } : m)));
      toast.error(error.message);
      return;
    }
    delete outbox.current[clientId];
    merge([data as ChatMessage]);
    void sign([data as ChatMessage]);
    void refresh();
  };

  const send = (o: Outgoing) => {
    const clientId = uuid();
    const withReply = { ...o, reply_to: replyTo?.id || null } as Outgoing & { reply_to: string | null };
    outbox.current[clientId] = withReply;
    // Brouillon affiché tout de suite (photos en aperçu local)
    const fileList = o.voice ? [o.voice.file] : o.files;
    const local: Record<string, string> = {};
    const atts: Attachment[] = fileList.map((f, i) => {
      const path = `local:${clientId}:${i}`;
      local[path] = URL.createObjectURL(f);
      return { path, name: f.name, type: f.type || "application/octet-stream", size: f.size, duration: o.voice?.duration };
    });
    setUrls(u => ({ ...u, ...local }));
    const draft: ChatMessage = {
      id: `local-${clientId}`, conversation_id: conv, sender_id: me, kind: kindOf(o), body: o.text, attachments: atts,
      location: o.location || null, contact: o.contact || null, meta: null, reply_to: replyTo?.id || null, client_id: clientId,
      created_at: new Date().toISOString(), edited_at: null, deleted_at: null, _pending: true,
    };
    atBottom.current = true;
    setMsgs(prev => [...(prev || []), draft]);
    setReplyTo(null);
    void deliver(clientId);
  };

  const retry = (m: ChatMessage) => {
    if (!m.client_id || !outbox.current[m.client_id]) return;
    setMsgs(prev => (prev || []).map(x => (x.client_id === m.client_id ? { ...x, _pending: true, _failed: false } : x)));
    void deliver(m.client_id);
  };

  const edit = async (m: ChatMessage, body: string) => {
    const { error } = await db.rpc("chat_edit_message", { p_id: m.id, p_body: body });
    if (error) toast.error(error.message);
    else merge([{ ...m, body, edited_at: new Date().toISOString() }]);
  };

  const remove = async (m: ChatMessage) => {
    setSelected(null);
    if (m._failed || m.id.startsWith("local-")) {
      setMsgs(prev => (prev || []).filter(x => x.id !== m.id));
      return;
    }
    const paths = (m.attachments || []).map(a => a.path);
    const { error } = await db.rpc("chat_delete_message", { p_id: m.id });
    if (error) { toast.error(error.message); return; }
    if (paths.length) void supabase.storage.from(CHAT_BUCKET).remove(paths);
    merge([{ ...m, deleted_at: new Date().toISOString(), body: "", attachments: [], location: null, contact: null }]);
  };

  const react = async (m: ChatMessage, emoji: string) => {
    setSelected(null);
    const mine = (reactions[m.id] || []).find(r => r.user_id === me);
    setReactions(prev => ({
      ...prev,
      [m.id]: [...(prev[m.id] || []).filter(r => r.user_id !== me), ...(mine?.emoji === emoji ? [] : [{ message_id: m.id, user_id: me, emoji }])],
    }));
    const q = mine?.emoji === emoji
      ? db.from("chat_reactions").delete().eq("message_id", m.id).eq("user_id", me)
      : db.from("chat_reactions").upsert({ message_id: m.id, user_id: me, emoji }, { onConflict: "message_id,user_id" });
    const { error } = await q;
    if (error) { toast.error(error.message); void loadReactions([m.id]); }
  };

  const copy = async (m: ChatMessage) => {
    setSelected(null);
    try { await navigator.clipboard.writeText(m.body); toast.success(tr("Copié", "تم النسخ", "Copied")); } catch { /* ignore */ }
  };

  const setFlags = async (p: { p_muted?: boolean; p_closed?: boolean }) => {
    const { error } = await db.rpc("chat_set_flags", { p_conv: conv, ...p });
    if (error) toast.error(error.message);
    else void refresh();
  };

  // ------------------------------------------------------------ affichage
  const byId = useMemo(() => {
    const m: Record<string, ChatMessage> = {};
    (msgs || []).forEach(x => { m[x.id] = x; });
    return m;
  }, [msgs]);

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return tr("Aujourd'hui", "اليوم", "Today");
    if (d.toDateString() === y.toDateString()) return tr("Hier", "أمس", "Yesterday");
    return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  };
  const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const otherRead = contact.other_read_at ? new Date(contact.other_read_at).getTime() : 0;
  const lastMineId = useMemo(() => [...(msgs || [])].reverse().find(m => m.sender_id === me && m.kind !== "call")?.id, [msgs, me]);

  const subtitle = (() => {
    if (peer.activity === "typing") return { text: tr("écrit…", "يكتب…", "typing…"), live: true };
    if (peer.activity === "recording") return { text: tr("enregistre un vocal…", "يسجل رسالة صوتية…", "recording audio…"), live: true };
    if (peer.activity === "uploading") return { text: tr("envoie un fichier…", "يرسل ملفا…", "sending a file…"), live: true };
    if (peerHere || isOnline(contact.last_seen_at)) return { text: tr("En ligne", "متصل الآن", "Online"), live: false, online: true };
    if (contact.last_seen_at) {
      const min = Math.round((now - new Date(contact.last_seen_at).getTime()) / 60000);
      const rel = min < 60 ? tr(`il y a ${min} min`, `منذ ${min} د`, `${min} min ago`)
        : min < 60 * 24 ? tr(`à ${timeOf(contact.last_seen_at)}`, `على ${timeOf(contact.last_seen_at)}`, `at ${timeOf(contact.last_seen_at)}`)
        : new Date(contact.last_seen_at).toLocaleDateString(locale, { day: "numeric", month: "short" });
      return { text: tr(`Vu ${rel}`, `آخر ظهور ${rel}`, `Seen ${rel}`), live: false };
    }
    return { text: contact.room_names || (contact.role === "professor" ? tr("Professeur", "أستاذ", "Teacher") : tr("Élève", "تلميذ", "Student")), live: false };
  })();

  const inCall = !!call && call.phase !== "ended";
  const peerName = contact.name;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* En-tête */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur sm:px-3">
        <button type="button" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted lg:hidden" aria-label={tr("Retour", "رجوع", "Back")}>
          <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
        </button>
        <ChatAvatar id={contact.user_id} name={contact.name} url={contact.avatar_url} size={40} online={subtitle.online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{contact.name}</p>
          <p className={cn("truncate text-xs", subtitle.live || subtitle.online ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} aria-live="polite">
            {subtitle.text}
          </p>
        </div>
        {contact.can_call && canWrite && (
          <button
            type="button"
            onClick={() => void startCall(contact)}
            disabled={inCall}
            className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-muted disabled:opacity-40"
            aria-label={tr("Appel vocal", "مكالمة صوتية", "Voice call")}
            title={tr("Appel vocal", "مكالمة صوتية", "Voice call")}
          >
            <Phone className="h-5 w-5" />
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted" aria-label={tr("Options", "خيارات", "Options")}>
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={() => void setFlags({ p_muted: !contact.muted })}>
              {contact.muted ? <Bell className="me-2 h-4 w-4" /> : <BellOff className="me-2 h-4 w-4" />}
              {contact.muted ? tr("Réactiver les notifications", "تفعيل الإشعارات", "Unmute") : tr("Mettre en sourdine", "كتم الإشعارات", "Mute notifications")}
            </DropdownMenuItem>
            {isTeacher && (
              <DropdownMenuItem onSelect={() => void setFlags({ p_closed: !contact.closed })}>
                {contact.closed ? <LockOpen className="me-2 h-4 w-4" /> : <Lock className="me-2 h-4 w-4" />}
                {contact.closed ? tr("Rouvrir la discussion", "إعادة فتح المحادثة", "Reopen chat") : tr("Fermer la discussion (lecture seule)", "إغلاق المحادثة (قراءة فقط)", "Close chat (read-only)")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto overflow-x-hidden bg-muted/30 px-2 py-3 sm:px-4 dark:bg-muted/10" style={CHAT_BG}>
          {msgs === null ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {loadingOlder && <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin text-muted-foreground" />}
              {!hasMore && (
                <div className="mx-auto mb-4 mt-2 max-w-sm rounded-xl border bg-background/90 p-4 text-center text-xs text-muted-foreground shadow-sm">
                  <ChatAvatar id={contact.user_id} name={contact.name} url={contact.avatar_url} size={64} className="mx-auto mb-2" />
                  <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                  {contact.room_names && <p>{contact.room_names}</p>}
                  <p className="mt-2 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {tr("Discussion privée : visible uniquement par vous deux.", "محادثة خاصة: لا يراها إلا أنتما.", "Private chat: only the two of you can see it.")}
                  </p>
                  {!isTeacher && msgs.length === 0 && (
                    <p className="mt-1">{tr("Posez vos questions sur le cours, un exercice ou un devoir.", "اطرح أسئلتك حول الدرس أو تمرين أو واجب.", "Ask about the lesson, an exercise or homework.")}</p>
                  )}
                </div>
              )}
              {msgs.map((m, i) => {
                const prev = msgs[i - 1];
                const next = msgs[i + 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const joinPrev = !newDay && prev && prev.sender_id === m.sender_id && prev.kind !== "call" && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_GAP;
                const joinNext = next && next.sender_id === m.sender_id && next.kind !== "call" && new Date(next.created_at).toDateString() === new Date(m.created_at).toDateString()
                  && new Date(next.created_at).getTime() - new Date(m.created_at).getTime() < GROUP_GAP;
                return (
                  <div key={m.id} id={`msg-${m.id}`}>
                    {newDay && (
                      <div className="flex justify-center py-2">
                        <span className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur">{dayLabel(m.created_at)}</span>
                      </div>
                    )}
                    {unreadMarker.current === m.id && (
                      <div className="my-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                        <span className="h-px flex-1 bg-primary/30" />{tr("Nouveaux messages", "رسائل جديدة", "New messages")}<span className="h-px flex-1 bg-primary/30" />
                      </div>
                    )}
                    {m.kind === "call" ? (
                      <CallLine m={m} me={me} tr={tr} time={timeOf(m.created_at)}
                        onCallBack={m.sender_id !== me && m.meta?.status !== "ended" && contact.can_call && canWrite && !inCall ? () => void startCall(contact) : undefined} />
                    ) : (
                      <Bubble
                        m={m}
                        mine={m.sender_id === me}
                        joinPrev={!!joinPrev}
                        joinNext={!!joinNext}
                        urls={urls}
                        reactions={reactions[m.id] || []}
                        me={me}
                        replied={m.reply_to ? byId[m.reply_to] : undefined}
                        replyName={(r: ChatMessage) => (r.sender_id === me ? tr("Vous", "أنت", "You") : peerName)}
                        tr={tr}
                        time={timeOf(m.created_at)}
                        status={m.sender_id !== me ? null : m._failed ? "failed" : m._pending ? "pending" : otherRead >= new Date(m.created_at).getTime() ? "read" : "sent"}
                        showStatus={m.sender_id === me && (m.id === lastMineId || !!m._pending || !!m._failed)}
                        selected={selected?.id === m.id}
                        onSelect={() => !m.deleted_at && setSelected(m)}
                        onReply={() => { if (canWrite && !m.deleted_at) setReplyTo(m); }}
                        onOpenMedia={(items, index) => setViewer({ items, index })}
                        onRetry={() => retry(m)}
                        onJump={id => document.getElementById(`msg-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      />
                    )}
                  </div>
                );
              })}
              {peer.activity !== "idle" && (
                <div className="mt-1 flex items-end gap-2">
                  <div className="rounded-2xl rounded-es-md bg-background px-4 py-3 shadow-sm ring-1 ring-border">
                    <span className="flex gap-1" aria-label={subtitle.text}>
                      {[0, 1, 2].map(i => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 0.15}s` }} />)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {(newBelow > 0 || !atBottom.current) && msgs && msgs.length > 10 && (
          <button
            type="button"
            onClick={() => { atBottom.current = true; scrollToBottom(true); markRead(); }}
            className="absolute bottom-3 end-3 flex h-10 items-center gap-1 rounded-full bg-background px-3 text-sm shadow-lg ring-1 ring-border"
            aria-label={tr("Aller aux derniers messages", "الانتقال إلى آخر الرسائل", "Jump to latest")}
          >
            {newBelow > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{newBelow}</span>}
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Actions sur un message sélectionné (appui long / bouton ⋯) */}
      {selected && (
        <div className="shrink-0 border-t bg-background px-3 py-2 shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.15)]">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex gap-1">
              {canWrite && QUICK_REACTIONS.map(e => (
                <button key={e} type="button" onClick={() => void react(selected, e)}
                  className={cn("rounded-full p-1.5 text-2xl transition-transform hover:scale-110", (reactions[selected.id] || []).some(r => r.user_id === me && r.emoji === e) && "bg-primary/15")}>
                  {e}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded-full p-1.5 hover:bg-muted" aria-label={tr("Fermer", "إغلاق", "Close")}><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {canWrite && <ActionBtn icon={Reply} label={tr("Répondre", "رد", "Reply")} onClick={() => { setReplyTo(selected); setSelected(null); }} />}
            {selected.body && <ActionBtn icon={Copy} label={tr("Copier", "نسخ", "Copy")} onClick={() => void copy(selected)} />}
            {selected.sender_id === me && selected.kind === "text" && !selected._pending && canWrite
              && Date.now() - new Date(selected.created_at).getTime() < 15 * 60 * 1000 && (
              <ActionBtn icon={Pencil} label={tr("Modifier", "تعديل", "Edit")} onClick={() => { setEditing(selected); setSelected(null); }} />
            )}
            {selected.sender_id === me && !selected._pending && (
              <ActionBtn icon={Trash2} danger label={tr("Supprimer pour tous", "حذف للجميع", "Delete for everyone")} onClick={() => void remove(selected)} />
            )}
          </div>
        </div>
      )}

      <ChatComposer
        tr={tr}
        disabled={!canWrite}
        disabledReason={
          !contact.can_chat
            ? tr("La messagerie n'est pas disponible pour cette discussion.", "المراسلة غير متاحة لهذه المحادثة.", "Messaging isn't available for this chat.")
            : tr("Le professeur a fermé cette discussion. Vous pouvez toujours lire les messages.", "أغلق الأستاذ هذه المحادثة. يمكنك قراءة الرسائل فقط.", "The teacher closed this chat. You can still read the messages.")
        }
        replyTo={replyTo}
        replyName={replyTo ? (replyTo.sender_id === me ? tr("vous-même", "نفسك", "yourself") : peerName) : undefined}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSend={send}
        onEdit={(m, t) => void edit(m, t)}
        onActivity={sendActivity}
      />

      {viewer && <MediaViewer items={viewer.items} start={viewer.index} urls={urls} tr={tr} onClose={() => setViewer(null)} />}
    </div>
  );
}

/** Message fait seulement d'émojis (affiché en grand). Sans le support Unicode du navigateur : non. */
function isOnlyEmoji(text: string) {
  const t = text.trim();
  if (!t || t.length > 12) return false;
  try {
    return new RegExp("^(\\p{Extended_Pictographic}|\\p{Emoji_Component}|\u200d|\ufe0f|\\s){1,8}$", "u").test(t) && !/^[\d#*\s]+$/.test(t);
  } catch {
    return false;
  }
}

function ActionBtn({ icon: Icon, label, onClick, danger }: { icon: typeof Reply; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm hover:bg-muted", danger && "border-rose-200 text-rose-600 dark:border-rose-900 dark:text-rose-400")}>
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}

function Bubble({
  m, mine, joinPrev, joinNext, urls, reactions, me, replied, replyName, tr, time, status, showStatus, selected,
  onSelect, onReply, onOpenMedia, onRetry, onJump,
}: {
  m: ChatMessage; mine: boolean; joinPrev: boolean; joinNext: boolean; urls: Record<string, string>; reactions: Reaction[]; me: string;
  replied?: ChatMessage; replyName: (r: ChatMessage) => string; tr: Tr; time: string;
  status: "pending" | "sent" | "read" | "failed" | null; showStatus: boolean; selected: boolean;
  onSelect: () => void; onReply: () => void; onOpenMedia: (items: Attachment[], index: number) => void; onRetry: () => void; onJump: (id: string) => void;
}) {
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startX = useRef(0);
  const [swipe, setSwipe] = useState(0);
  const att = m.attachments || [];
  const media = att.filter(a => ["image", "video"].includes(attachmentKind(a.type)));
  const docs = att.filter(a => !["image", "video"].includes(attachmentKind(a.type)));
  const onlyMedia = media.length > 0 && !m.body && !docs.length && !m.location && !m.contact && !replied;
  const onlyEmoji = !att.length && isOnlyEmoji(m.body);

  const grouped = Object.entries(reactions.reduce<Record<string, number>>((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {}));

  const touchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    press.current = setTimeout(() => { try { navigator.vibrate?.(20); } catch { /* ignore */ } onSelect(); }, 450);
  };
  const touchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    if (Math.abs(dx) > 8 && press.current) { clearTimeout(press.current); press.current = null; }
    // Glisser vers le côté pour répondre
    const rtl = document.documentElement.dir === "rtl" || !!(e.currentTarget as HTMLElement).closest("[dir=rtl]");
    const v = rtl ? -dx : dx;
    if (v > 0) setSwipe(Math.min(v, 70));
  };
  const touchEnd = () => {
    if (press.current) { clearTimeout(press.current); press.current = null; }
    if (swipe > 55) onReply();
    setSwipe(0);
  };

  const radius = mine
    ? cn("rounded-2xl", joinPrev && "rounded-se-md", joinNext && "rounded-ee-md")
    : cn("rounded-2xl", joinPrev && "rounded-ss-md", joinNext && "rounded-es-md");

  const meta = (
    <span className={cn("ms-2 inline-flex translate-y-0.5 items-center gap-0.5 whitespace-nowrap align-bottom text-[10px]",
      onlyMedia ? "rounded-full bg-black/45 px-1.5 py-0.5 text-white" : mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
      {m.edited_at && <span>{tr("modifié", "معدلة", "edited")} ·</span>}
      {time}
      {showStatus && status === "pending" && <Clock className="h-3 w-3" aria-label={tr("Envoi…", "جارٍ الإرسال…", "Sending…")} />}
      {showStatus && status === "sent" && <Check className="h-3.5 w-3.5" aria-label={tr("Envoyé", "أُرسلت", "Sent")} />}
      {showStatus && status === "read" && <CheckCheck className={cn("h-3.5 w-3.5", mine && !onlyMedia ? "text-sky-200" : "text-sky-400")} aria-label={tr("Lu", "مقروءة", "Read")} />}
    </span>
  );

  return (
    <div className={cn("group flex items-end gap-1", mine ? "justify-end" : "justify-start", joinPrev ? "mt-0.5" : "mt-2", grouped.length > 0 && "mb-3")}>
      {/* Boutons au survol (ordinateur) */}
      {mine && !m.deleted_at && <HoverActions onReply={onReply} onMore={onSelect} tr={tr} />}
      <div
        className={cn("relative max-w-[82%] transition-transform sm:max-w-[68%]", selected && "scale-[0.98]")}
        style={swipe ? { transform: `translateX(${document.documentElement.dir === "rtl" ? -swipe : swipe}px)` } : undefined}
        onTouchStart={touchStart}
        onTouchMove={touchMove}
        onTouchEnd={touchEnd}
        onContextMenu={e => { e.preventDefault(); onSelect(); }}
      >
        {m.deleted_at ? (
          <div className={cn("px-3 py-2 text-sm italic ring-1 ring-border", radius, "bg-background/70 text-muted-foreground")}>
            🚫 {mine ? tr("Vous avez supprimé ce message", "حذفت هذه الرسالة", "You deleted this message") : tr("Message supprimé", "رسالة محذوفة", "Message deleted")}
          </div>
        ) : onlyEmoji ? (
          <div className="px-1 text-4xl leading-tight">{m.body}<div className="text-end">{meta}</div></div>
        ) : (
          <div className={cn(
            "text-[15px] leading-[1.35] shadow-sm",
            radius,
            onlyMedia ? "overflow-hidden p-0.5" : "px-3 py-1.5",
            mine ? "bg-primary text-primary-foreground" : "bg-background text-foreground ring-1 ring-border",
            selected && "ring-2 ring-primary/60",
            m._failed && "opacity-70",
          )}>
            {replied && (
              <button type="button" onClick={() => onJump(replied.id)}
                className={cn("mb-1 block w-full rounded-lg border-s-4 px-2 py-1 text-start text-xs", mine ? "border-primary-foreground/70 bg-primary-foreground/15" : "border-primary bg-muted")}>
                <span className="block font-semibold">{replyName(replied)}</span>
                <span className="line-clamp-2 opacity-80">{replied.deleted_at ? tr("Message supprimé", "رسالة محذوفة", "Message deleted") : replied.body || (replied.kind === "voice" ? "🎤" : replied.attachments?.length ? "📎" : replied.kind === "location" ? "📍" : "👤")}</span>
              </button>
            )}
            {media.length > 0 && (
              <div className={cn(!onlyMedia && "-mx-2 mb-1 mt-0.5", "relative")}>
                <MediaGrid items={media} urls={urls} onOpen={i => onOpenMedia(media, i)} />
                {m._pending && <span className="absolute inset-0 flex items-center justify-center bg-black/30"><Loader2 className="h-7 w-7 animate-spin text-white" /></span>}
                {onlyMedia && <span className="absolute bottom-1.5 end-1.5">{meta}</span>}
              </div>
            )}
            {docs.map(a => (
              <div key={a.path} className="my-1">
                {m.kind === "voice"
                  ? <VoicePlayer url={m._pending ? undefined : urls[a.path]} duration={a.duration} mine={mine} seed={m.id} />
                  : <FileCard a={a} url={m._pending ? undefined : urls[a.path]} mine={mine} tr={tr} />}
              </div>
            ))}
            {m.contact && <div className="my-1"><ContactCard c={m.contact} mine={mine} tr={tr} /></div>}
            {m.location && <div className="-mx-1 my-1"><LocationCard loc={m.location} mine={mine} tr={tr} /></div>}
            {m.body ? (
              <p className="whitespace-pre-wrap break-words" dir="auto"><Linkified text={m.body} />{meta}</p>
            ) : !onlyMedia ? <div className="text-end">{meta}</div> : null}
          </div>
        )}
        {grouped.length > 0 && (
          <div className={cn("absolute -bottom-3.5 flex gap-0.5", mine ? "end-2" : "start-2")}>
            <span className="flex items-center gap-0.5 rounded-full bg-background px-1.5 py-0.5 text-sm shadow ring-1 ring-border">
              {grouped.map(([e]) => <span key={e}>{e}</span>)}
              {reactions.length > 1 && <span className="ms-0.5 text-[10px] text-muted-foreground">{reactions.length}</span>}
              {reactions.some(r => r.user_id === me) && <span className="sr-only">(vous)</span>}
            </span>
          </div>
        )}
        {m._failed && (
          <button type="button" onClick={onRetry} className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
            <AlertCircle className="h-3.5 w-3.5" />{tr("Non envoyé · Réessayer", "لم تُرسل · إعادة المحاولة", "Not sent · Retry")}
          </button>
        )}
      </div>
      {!mine && !m.deleted_at && <HoverActions onReply={onReply} onMore={onSelect} tr={tr} />}
    </div>
  );
}

function HoverActions({ onReply, onMore, tr }: { onReply: () => void; onMore: () => void; tr: Tr }) {
  return (
    <div className="mb-1 hidden shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:flex">
      <button type="button" onClick={onMore} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Réagir", "تفاعل", "React")}><Smile className="h-4 w-4" /></button>
      <button type="button" onClick={onReply} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Répondre", "رد", "Reply")}><Reply className="h-4 w-4" /></button>
      <button type="button" onClick={onMore} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted" aria-label={tr("Plus", "المزيد", "More")}><MoreVertical className="h-4 w-4" /></button>
    </div>
  );
}

/** Visionneuse plein écran (photos et vidéos), précédent / suivant, téléchargement */
function MediaViewer({ items, start, urls, tr, onClose }: { items: Attachment[]; start: number; urls: Record<string, string>; tr: Tr; onClose: () => void }) {
  const [i, setI] = useState(start);
  const a = items[i];
  const url = urls[a.path];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI(n => Math.min(items.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI(n => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [items.length, onClose]);
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex h-full flex-col bg-black/95" dir="ltr">
      <div className="flex items-center justify-between p-3 text-white" style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}>
        <span className="text-sm opacity-80">{items.length > 1 ? `${i + 1} / ${items.length}` : a.name}</span>
        <div className="flex gap-1">
          {url && <a href={`${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(a.name)}`} download={a.name} className="rounded-full p-2 hover:bg-white/10" aria-label={tr("Télécharger", "تحميل", "Download")}><Download className="h-5 w-5" /></a>}
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label={tr("Fermer", "إغلاق", "Close")}><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="flex max-h-full max-w-full items-center justify-center">
          {!url ? <Loader2 className="h-8 w-8 animate-spin text-white" />
            : attachmentKind(a.type) === "video"
              ? <video key={url} src={url} controls autoPlay playsInline className="max-h-[80vh] max-w-full" />
              : <img src={url} alt={a.name} className="max-h-[85vh] max-w-full object-contain" />}
        </div>
        {i > 0 && (
          <button type="button" onClick={e => { e.stopPropagation(); setI(i - 1); }} className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label={tr("Précédent", "السابق", "Previous")}>
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {i < items.length - 1 && (
          <button type="button" onClick={e => { e.stopPropagation(); setI(i + 1); }} className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20" aria-label={tr("Suivant", "التالي", "Next")}>
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
