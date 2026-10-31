"use client";

/** Bouton « Messages » de la barre du haut, avec le nombre de messages non lus */
import { MessageCircle } from "lucide-react";
import { NavLink } from "@/lib/router";
import { useChatOptional } from "@/contexts/ChatContext";
import { useLanguage } from "@/contexts/LanguageContext";

export function ChatUnreadBadge({ className = "" }: { className?: string }) {
  const chat = useChatOptional();
  const n = chat?.unread || 0;
  if (!n) return null;
  return (
    <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white ${className}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

export default function ChatNavButton() {
  const chat = useChatOptional();
  const { language } = useLanguage();
  if (!chat?.enabled) return null;
  const label = language === "ar" ? "الرسائل" : language === "en" ? "Messages" : "Messages";
  return (
    <NavLink
      to="/messages"
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={chat.unread ? `${label} (${chat.unread})` : label}
      title={label}
    >
      <MessageCircle className="h-[18px] w-[18px]" />
      <ChatUnreadBadge className="absolute -end-0.5 -top-0.5" />
    </NavLink>
  );
}
