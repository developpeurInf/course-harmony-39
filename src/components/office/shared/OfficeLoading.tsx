import { Loader2 } from "lucide-react";
import { APP_ICON, OFFICE_ACCENT } from "./OfficeShell";
import type { OfficeApp } from "./officeStore";

export function OfficeLoading({ app }: { app: OfficeApp }) {
  const Icon = APP_ICON[app];
  const m = OFFICE_ACCENT[app];
  return (
    <div className="flex h-full min-h-[60vh] flex-1 flex-col items-center justify-center gap-3">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: m.accent }}>
        <Icon className="h-8 w-8" strokeWidth={1.6} />
      </span>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {m.name}
      </div>
    </div>
  );
}
