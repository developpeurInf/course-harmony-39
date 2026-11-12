/** Vignettes des modèles (menu Fichier → Nouveau) */
export function GridThumb({ accent, variant }: { accent: string; variant: string }) {
  const blank = variant === "blank";
  return (
    <div className="flex h-full w-full flex-col bg-white p-2">
      {!blank && <div className="mb-1 h-2 w-1/2 rounded-sm" style={{ background: accent }} />}
      <div className="grid flex-1 grid-cols-5 grid-rows-6 border-s border-t border-slate-200">
        {Array.from({ length: 30 }, (_, i) => (
          <div
            key={i}
            className="border-b border-e border-slate-200"
            style={!blank && i < 5 ? { background: accent, opacity: 0.85 } : !blank && i % 5 === 4 && i > 5 ? { background: `${accent}22` } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export function DocThumb({ variant, accent }: { variant: string; accent: string }) {
  const lines = (n: number, w = "100%") => Array.from({ length: n }, (_, i) => <div key={i} className="mb-[3px] h-[3px] rounded-full bg-slate-300" style={{ width: i === n - 1 ? "60%" : w }} />);
  return (
    <div className="flex h-full w-full items-start justify-center bg-slate-100 pt-2">
      <div className="h-[110%] w-[70%] bg-white p-2 shadow-sm">
        {variant === "blank" ? null : variant === "letter" ? (
          <>
            <div className="mb-2 ms-auto h-[3px] w-1/3 rounded-full bg-slate-400" />
            <div className="mb-2 h-[3px] w-1/3 rounded-full bg-slate-400" />
            {lines(7)}
          </>
        ) : variant === "report" ? (
          <>
            <div className="mb-1 h-[6px] w-2/3 rounded-sm" style={{ background: accent }} />
            <div className="mb-2 h-[3px] w-1/3 rounded-full bg-slate-400" />
            {lines(4)}
            <div className="my-1 h-[4px] w-1/2 rounded-sm" style={{ background: accent, opacity: 0.7 }} />
            {lines(3)}
          </>
        ) : variant === "exam" ? (
          <>
            <div className="mb-1 flex justify-between"><div className="h-[3px] w-1/4 bg-slate-400" /><div className="h-[3px] w-1/4 bg-slate-400" /></div>
            <div className="mx-auto mb-2 h-[5px] w-1/2 rounded-sm" style={{ background: accent }} />
            <div className="mb-1 h-[3px] w-1/3 rounded-full" style={{ background: accent, opacity: 0.7 }} />
            {lines(3)}
            <div className="mb-1 mt-1 h-[3px] w-1/3 rounded-full" style={{ background: accent, opacity: 0.7 }} />
            {lines(3)}
          </>
        ) : (
          <>
            <div className="mb-1 h-[5px] w-1/2 rounded-sm" style={{ background: accent }} />
            {lines(3)}
            <div className="my-1 grid grid-cols-3 gap-[2px]">{Array.from({ length: 9 }, (_, i) => <div key={i} className="h-[6px] bg-slate-200" />)}</div>
            {lines(3)}
          </>
        )}
      </div>
    </div>
  );
}

export function SlideThumb({ bg, fg, accent, variant }: { bg: string; fg: string; accent: string; variant?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 p-2 dark:bg-slate-800">
      <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-sm shadow" style={{ background: bg }}>
        {variant !== "blank" && (
          <>
            <div className="absolute inset-y-0 start-0 w-[6%]" style={{ background: accent }} />
            <div className="mb-1 h-[8%] w-1/2 rounded-sm" style={{ background: fg }} />
            <div className="h-[4%] w-1/3 rounded-sm opacity-60" style={{ background: fg }} />
          </>
        )}
      </div>
    </div>
  );
}
