"use client";

/**
 * Messagerie élève ↔ professeur.
 * Élève : ses professeurs uniquement. Professeur : les élèves de ses classes.
 * Ordinateur / iPad paysage : liste + discussion côte à côte. Téléphone : l'une puis l'autre.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BellOff, Loader2, Lock, MessageCircle, MessagesSquare, Mic, PhoneMissed, Search, ShieldCheck, Image as ImageIcon, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useChat } from "@/contexts/ChatContext";
import { useNavigate, useSearchParams } from "@/lib/router";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { db, isOnline, type ChatContact } from "@/lib/chat";
import { ChatAvatar } from "@/components/chat/ChatAvatar";
import { ChatThread } from "@/components/chat/ChatThread";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Messages() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { contacts, refresh, setActiveConversation, allowCalls, setAllowCalls } = useChat();
  const navigate = useNavigate();
  const params = useSearchParams();
  const selectedId = params?.get("c") || null;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [opening, setOpening] = useState<string | null>(null);
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const locale = language === "ar" ? "ar-MA" : language === "en" ? "en-GB" : "fr-FR";
  const isTeacher = user?.role === "professor";
  const me = user?.id || "";

  const selected = useMemo(() => contacts?.find(c => c.user_id === selectedId) || null, [contacts, selectedId]);

  useEffect(() => {
    setActiveConversation(selected?.conversation_id || null);
    return () => setActiveConversation(null);
  }, [selected?.conversation_id, setActiveConversation]);

  // Discussion pas encore créée : on la crée à l'ouverture
  useEffect(() => {
    if (!selected || selected.conversation_id || opening === selected.user_id || !selected.can_chat) return;
    setOpening(selected.user_id);
    void db.rpc("chat_open", { p_other: selected.user_id }).then(async ({ error }: any) => {
      if (error) toast.error(error.message);
      await refresh();
      setOpening(null);
    });
  }, [selected, opening, refresh]);

  const open = (c: ChatContact) => navigate(`/messages?c=${c.user_id}`);
  const back = () => navigate("/messages");

  const { active, others } = useMemo(() => {
    const n = norm(q.trim());
    const list = (contacts || []).filter(c => !n || norm(c.name).includes(n) || norm(c.room_names || "").includes(n));
    const active = list
      .filter(c => c.last_message_at && (filter === "all" || c.unread > 0))
      .sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
    const others = filter === "unread" ? [] : list.filter(c => !c.last_message_at && c.can_chat).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return { active, others };
  }, [contacts, q, filter]);

  // Élèves sans discussion regroupés par classe (professeur)
  const othersByRoom = useMemo(() => {
    const m = new Map<string, ChatContact[]>();
    others.forEach(c => {
      const k = c.room_names || tr("Autres", "أخرى", "Others");
      m.set(k, [...(m.get(k) || []), c]);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [others]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeLabel = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    if (now.getTime() - d.getTime() < 6 * 86400000) return d.toLocaleDateString(locale, { weekday: "short" });
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  };

  const previewIcon = (p: string | null) =>
    !p ? null : p.startsWith("🎤") ? Mic : p.startsWith("📷") || p.startsWith("🎬") ? ImageIcon : p.startsWith("📞") ? PhoneMissed : null;

  const totalUnread = (contacts || []).reduce((n, c) => n + (c.unread || 0), 0);

  return (
    <div dir={language === "ar" ? "rtl" : "ltr"} className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      {/* Liste */}
      <aside className={cn("flex min-h-0 w-full flex-col border-e lg:w-[360px] lg:shrink-0", selectedId && "hidden lg:flex")}>
        <div className="space-y-3 border-b px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold">{tr("Messages", "الرسائل", "Messages")}</h1>
            {isTeacher && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {tr("Recevoir les appels", "استقبال المكالمات", "Receive calls")}
                <Switch checked={allowCalls} onCheckedChange={v => void setAllowCalls(v)} aria-label={tr("Recevoir les appels", "استقبال المكالمات", "Receive calls")} />
              </label>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={isTeacher ? tr("Rechercher un élève ou une classe", "ابحث عن تلميذ أو قسم", "Search a student or class") : tr("Rechercher un professeur", "ابحث عن أستاذ", "Search a teacher")}
              className="h-10 w-full rounded-full bg-muted pe-9 ps-9 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              aria-label={tr("Rechercher", "بحث", "Search")}
            />
            {q && <button type="button" onClick={() => setQ("")} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-background" aria-label={tr("Effacer", "مسح", "Clear")}><X className="h-4 w-4" /></button>}
          </div>
          <div className="flex gap-1.5">
            {(["all", "unread"] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={cn("rounded-full px-3 py-1 text-xs font-medium", filter === f ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                {f === "all" ? tr("Toutes", "الكل", "All") : tr("Non lues", "غير مقروءة", "Unread")}
                {f === "unread" && totalUnread > 0 && <span className="ms-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{totalUnread}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {contacts === null ? (
            <div className="space-y-1 p-2">{[0, 1, 2, 3, 4].map(i => <div key={i} className="flex items-center gap-3 p-2"><div className="h-12 w-12 animate-pulse rounded-full bg-muted" /><div className="flex-1 space-y-2"><div className="h-3 w-1/2 animate-pulse rounded bg-muted" /><div className="h-3 w-3/4 animate-pulse rounded bg-muted" /></div></div>)}</div>
          ) : contacts.length === 0 ? (
            <Empty tr={tr} isTeacher={isTeacher} />
          ) : (
            <>
              {active.length > 0 && (
                <ul className="p-1.5">
                  {active.map(c => (
                    <li key={c.user_id}>
                      <button type="button" onClick={() => open(c)}
                        className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-muted/70", selectedId === c.user_id && "bg-primary/10 hover:bg-primary/10")}>
                        <ChatAvatar id={c.user_id} name={c.name} url={c.avatar_url} size={52} online={isOnline(c.last_seen_at)} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={cn("truncate text-[15px]", c.unread ? "font-bold" : "font-medium")}>{c.name}</span>
                            <span className={cn("shrink-0 text-[11px]", c.unread ? "font-semibold text-primary" : "text-muted-foreground")}>{c.last_message_at && timeLabel(c.last_message_at)}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5">
                            <span className={cn("min-w-0 flex-1 truncate text-[13px]", c.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                              {c.last_sender_id === me && <span className="text-muted-foreground">{tr("Vous : ", "أنت: ", "You: ")}</span>}
                              {(() => { const I = previewIcon(c.last_message_preview); return I ? <I className="me-1 inline h-3.5 w-3.5 align-[-2px]" /> : null; })()}
                              {(c.last_message_preview || "").replace(/^(🎤|📷|🎬|📞|📍|👤|📎|🎵)\s?/u, "")}
                            </span>
                            {c.closed && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={tr("Fermée", "مغلقة", "Closed")} />}
                            {c.muted && <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={tr("Sourdine", "مكتومة", "Muted")} />}
                            {c.unread > 0 && <span className={cn("flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white", c.muted ? "bg-muted-foreground" : "bg-primary")}>{c.unread > 99 ? "99+" : c.unread}</span>}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {others.length > 0 && (
                <div className="px-1.5 pt-2">
                  <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case">
                    {isTeacher ? tr("Écrire à un élève", "راسل تلميذا", "Message a student") : tr("Écrire à un professeur", "راسل أستاذا", "Message a teacher")}
                  </p>
                  {(isTeacher ? othersByRoom : [["", others] as [string, ChatContact[]]]).map(([room, list]) => (
                    <div key={room} className="mb-2">
                      {isTeacher && <p className="px-3 pb-0.5 pt-1 text-[11px] font-medium text-muted-foreground">{room}</p>}
                      <ul>
                        {list.map(c => (
                          <li key={c.user_id}>
                            <button type="button" onClick={() => open(c)}
                              className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-start hover:bg-muted/70", selectedId === c.user_id && "bg-primary/10")}>
                              <ChatAvatar id={c.user_id} name={c.name} url={c.avatar_url} size={40} online={isOnline(c.last_seen_at)} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">{c.name}</span>
                                {!isTeacher && c.room_names && <span className="block truncate text-xs text-muted-foreground">{c.room_names}</span>}
                              </span>
                              <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {active.length === 0 && others.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">{filter === "unread" ? tr("Aucun message non lu.", "لا توجد رسائل غير مقروءة.", "No unread messages.") : tr("Aucun résultat.", "لا توجد نتائج.", "No results.")}</p>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Discussion */}
      <section className={cn("min-h-0 min-w-0 flex-1", !selectedId && "hidden lg:block")}>
        {selected?.conversation_id ? (
          <ChatThread
            key={selected.conversation_id}
            contact={selected as ChatContact & { conversation_id: string }}
            me={me}
            isTeacher={isTeacher}
            tr={tr}
            locale={locale}
            onBack={back}
          />
        ) : selectedId && (contacts === null || opening) ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : selectedId && contacts && !selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <Lock className="h-8 w-8" />
            {tr("Cette discussion n'est pas disponible.", "هذه المحادثة غير متاحة.", "This chat isn't available.")}
            <button type="button" onClick={back} className="text-primary underline">{tr("Retour aux messages", "العودة إلى الرسائل", "Back to messages")}</button>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/20 p-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary"><MessagesSquare className="h-9 w-9" /></span>
            <h2 className="text-lg font-semibold">{tr("Vos discussions", "محادثاتك", "Your chats")}</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {isTeacher
                ? tr("Répondez aux questions de vos élèves en dehors de la classe : messages, photos d'exercices, vocaux et appels.", "أجب عن أسئلة تلاميذك خارج القسم: رسائل وصور تمارين ورسائل صوتية ومكالمات.", "Answer your students outside class: messages, exercise photos, voice notes and calls.")
                : tr("Une question sur le cours ou un exercice ? Écrivez à votre professeur, envoyez une photo ou un vocal.", "سؤال حول الدرس أو تمرين؟ راسل أستاذك وأرسل صورة أو رسالة صوتية.", "A question about the lesson or an exercise? Write to your teacher, send a photo or a voice note.")}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {isTeacher
                ? tr("Chaque discussion est privée entre vous et un élève.", "كل محادثة خاصة بينك وبين تلميذ.", "Each chat is private between you and one student.")
                : tr("Vous ne pouvez écrire qu'à vos professeurs.", "يمكنك مراسلة أساتذتك فقط.", "You can only write to your teachers.")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ tr, isTeacher }: { tr: (fr: string, ar: string, en: string) => string; isTeacher: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
      <MessagesSquare className="h-10 w-10" />
      {isTeacher
        ? tr("Aucun élève pour l'instant. Ajoutez des élèves à vos classes pour discuter avec eux.", "لا يوجد تلاميذ بعد. أضف تلاميذ إلى أقسامك للتواصل معهم.", "No students yet. Add students to your classes to chat with them.")
        : tr("Aucun professeur disponible pour la messagerie.", "لا يوجد أستاذ متاح للمراسلة.", "No teacher available for messaging.")}
    </div>
  );
}
