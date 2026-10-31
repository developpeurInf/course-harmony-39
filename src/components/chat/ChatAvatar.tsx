import { cn } from "@/lib/utils";
import { avatarTone, initialsOf } from "@/lib/chat";

/** Avatar rond avec pastille « en ligne » */
export function ChatAvatar({ id, name, url, size = 44, online, className }: {
  id: string;
  name: string;
  url?: string | null;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const dot = Math.max(10, Math.round(size / 4));
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt="" className="h-full w-full rounded-full object-cover" loading="lazy" />
      ) : (
        <span
          className={cn("flex h-full w-full items-center justify-center rounded-full font-semibold text-white", avatarTone(id))}
          style={{ fontSize: Math.round(size * 0.38) }}
          aria-hidden="true"
        >
          {initialsOf(name)}
        </span>
      )}
      {online && (
        <span
          className="absolute bottom-0 end-0 rounded-full border-2 border-background bg-emerald-500"
          style={{ width: dot, height: dot }}
          aria-label="en ligne"
        />
      )}
    </span>
  );
}
