"use client";

/**
 * Tableau blanc de classe en plein écran (/whiteboard/:boardId).
 * Enregistrement automatique + collaboration en direct (Supabase Realtime : diffusion + présence).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AlertTriangle, ArrowLeft, Check, CloudOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useNavigate, useParams } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { WbStore, DEFAULT_STATE, type Op } from "@/components/meet/whiteboard/model";
import { bounds, renderToCanvas, union } from "@/components/meet/whiteboard/render";
import { WhiteboardBoard } from "@/components/meet/whiteboard/Whiteboard";
import { useTr } from "@/components/meet/useTr";
import { getBoard, missingTable, updateBoard, type Board } from "@/lib/whiteboards";
import { initials, personHue } from "@/lib/meet";
import { cn } from "@/lib/utils";
import "@/components/meet/meet.css";

const BIG = 180_000;

interface Peer {
  id: string;
  name: string;
  write: boolean;
  at: number;
}

function thumbnail(store: WbStore) {
  const els = store.list("board").filter(e => !e.ttl);
  const box = union(els.map(bounds));
  if (!box) return null;
  const scale = Math.min(1, 520 / (box.w + 80), 320 / (box.h + 80));
  const c = renderToCanvas(els, store.state.theme, store.state.paper, box, scale);
  return c.toDataURL("image/jpeg", 0.72);
}

export default function WhiteboardEditor() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user, loading } = useAuth();
  const { rooms } = useCourses();
  const navigate = useNavigate();
  const { tr, dir } = useTr();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<"missing" | "notfound" | "other" | null>(null);

  useEffect(() => {
    if (!boardId || loading || !user) return;
    let alive = true;
    getBoard(boardId)
      .then(b => {
        if (!alive) return;
        if (!b) setError("notfound");
        else setBoard(b);
      })
      .catch(e => alive && setError(missingTable(e) ? "missing" : "other"));
    return () => {
      alive = false;
    };
  }, [boardId, user, loading]);

  const back = useCallback(() => {
    if (board && user?.role === "professor") navigate(`/rooms/${board.room_id}/whiteboard`);
    else navigate("/whiteboards");
  }, [board, user, navigate]);

  if (!loading && !user) {
    navigate("/login");
    return null;
  }

  if (error)
    return (
      <div dir={dir} className="flex h-[100dvh] items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <p className="font-semibold">
            {error === "missing"
              ? tr("Les tableaux blancs ne sont pas encore installés (migration SQL à lancer).", "السبورات البيضاء غير مثبتة بعد (يجب تشغيل ترحيل SQL).", "Whiteboards are not installed yet (SQL migration needed).")
              : error === "notfound"
                ? tr("Ce tableau n'existe pas ou n'est pas partagé avec vous.", "هذه السبورة غير موجودة أو غير مشتركة معك.", "This board doesn't exist or isn't shared with you.")
                : tr("Impossible d'ouvrir le tableau.", "تعذر فتح السبورة.", "Could not open the board.")}
          </p>
          <button type="button" onClick={() => navigate(user?.role === "professor" ? "/dashboard" : "/whiteboards")} className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {tr("Retour", "رجوع", "Back")}
          </button>
        </div>
      </div>
    );

  if (!board || !user)
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );

  const isOwner = board.owner_id === user.id || (user.role === "professor" && rooms.some(r => r.id === board.room_id));
  return <Editor key={board.id} board={board} me={user.id} myName={user.name || ""} isOwner={isOwner} onBack={back} />;
}

export function Editor(props: { board: Board; me: string; myName: string; isOwner: boolean; onBack: () => void }) {
  const { board, me, isOwner } = props;
  const { tr, dir } = useTr();
  const [title, setTitle] = useState(board.title);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [status, setStatus] = useState<"saved" | "saving" | "error">("saved");
  const peersRef = useRef<Peer[]>([]);
  const shareRef = useRef(board.share);

  const store = useMemo(() => {
    const s = new WbStore(me, props.myName, isOwner);
    s.state = {
      ...DEFAULT_STATE,
      open: true,
      allow: board.share === "edit",
      paper: board.data?.state?.paper || "dots",
      theme: board.data?.state?.theme || "light",
    };
    s.load(Array.isArray(board.data?.board) ? board.data.board : []);
    s.isHostId = id => id === board.owner_id;
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id]);
  useSyncExternalStore(store.subscribeState, store.getStateVersion, store.getStateVersion);

  // ------------------------------------------------------------------ enregistrement
  const savedVersion = useRef(store.version);
  const saving = useRef(false);
  const amSaver = () => {
    if (!store.canWrite) return false;
    const writers = peersRef.current.filter(p => p.write);
    if (isOwner) return true;
    if (writers.some(p => p.id === board.owner_id)) return false;
    const ids = [...writers.map(p => p.id), me].sort();
    return ids[0] === me;
  };
  const save = useCallback(
    async (force = false) => {
      if (saving.current) return;
      if (store.version === savedVersion.current && !force) return;
      if (!amSaver()) {
        savedVersion.current = store.version;
        return;
      }
      saving.current = true;
      setStatus("saving");
      const v = store.version;
      try {
        await updateBoard(board.id, {
          data: { board: store.list("board").filter(e => !e.ttl && !e.exp), state: { paper: store.state.paper, theme: store.state.theme } },
          thumb: thumbnail(store),
        });
        savedVersion.current = v;
        setStatus("saved");
      } catch {
        // nouvel essai au prochain changement (pas de boucle)
        setStatus("error");
        saving.current = false;
        return;
      }
      saving.current = false;
      if (store.version !== savedVersion.current) schedule();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, board.id],
  );
  const timer = useRef(0);
  const firstChange = useRef(0);
  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    const now = Date.now();
    if (!firstChange.current) firstChange.current = now;
    // au plus 6 s sans enregistrer pendant qu'on dessine
    const wait = now - firstChange.current > 6000 ? 0 : 1400;
    timer.current = window.setTimeout(() => {
      firstChange.current = 0;
      void save();
    }, wait);
  }, [save]);

  useEffect(() => {
    let last = store.version;
    const un = store.subscribe(() => {
      if (store.version === last) return;
      last = store.version;
      schedule();
    });
    const onHide = () => document.visibilityState === "hidden" && void save();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      un();
      document.removeEventListener("visibilitychange", onHide);
      window.clearTimeout(timer.current);
      void save();
    };
  }, [store, schedule, save]);

  // partage (bouton « Élèves ») et fond enregistrés par le professeur
  useEffect(() => {
    if (!isOwner) return;
    return store.subscribeState(() => {
      const share = store.state.allow ? "edit" : shareRef.current === "edit" ? "view" : shareRef.current;
      if (share !== shareRef.current) {
        shareRef.current = share;
        void updateBoard(board.id, { share }).catch(() => toast.error(tr("Partage non enregistré", "لم يتم حفظ المشاركة", "Sharing not saved")));
      }
      schedule();
    });
  }, [store, isOwner, board.id, schedule, tr]);

  // ------------------------------------------------------------------ temps réel
  useEffect(() => {
    const ch = supabase.channel(`wb-board-${board.id}`, { config: { broadcast: { self: false }, presence: { key: me } } });
    let ready = false;
    store.transport = {
      send: (op: Op) => {
        if (!ready) return;
        const payload = { from: me, op };
        const size = JSON.stringify(payload).length;
        if (size > BIG) {
          // image volumineuse : on enregistre puis on prévient les autres de recharger
          void save(true).then(() => ch.send({ type: "broadcast", event: "sync", payload: { from: me } }));
          return;
        }
        void ch.send({ type: "broadcast", event: "op", payload });
      },
    };
    const names = new Map<string, string>();
    store.nameOf = id => names.get(id) || "";
    ch.on("broadcast", { event: "op" }, ({ payload }) => {
      if (payload?.from && payload.from !== me) store.receive(payload.op, payload.from);
    });
    ch.on("broadcast", { event: "sync" }, async () => {
      try {
        const b = await getBoard(board.id);
        if (b?.data?.board) store.load(b.data.board);
      } catch {
        /* ignore */
      }
    });
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState<{ name: string; write: boolean; at: number }>();
      const list: Peer[] = [];
      for (const [id, metas] of Object.entries(st)) {
        const m = metas[0];
        if (!m) continue;
        names.set(id, m.name);
        if (id !== me) list.push({ id, name: m.name, write: !!m.write, at: m.at });
      }
      peersRef.current = list;
      setPeers(list);
    });
    ch.subscribe(async s => {
      if (s !== "SUBSCRIBED") return;
      ready = true;
      await ch.track({ name: props.myName, write: store.canWrite, at: Date.now() });
    });
    const unState = store.subscribeState(() => {
      if (ready) void ch.track({ name: props.myName, write: store.canWrite, at: Date.now() });
    });
    return () => {
      unState();
      ready = false;
      store.transport = { send: () => undefined };
      void supabase.removeChannel(ch);
    };
  }, [store, board.id, me, props.myName, save]);

  const rename = async (t: string) => {
    setTitle(t);
    try {
      await updateBoard(board.id, { title: t });
    } catch {
      toast.error(tr("Titre non enregistré", "لم يتم حفظ العنوان", "Title not saved"));
    }
  };

  const extra = (
    <div className="flex items-center gap-1.5 px-1">
      {peers.length > 0 && (
        <div className="flex -space-x-1.5 rtl:space-x-reverse" title={peers.map(p => p.name).join(", ")}>
          {peers.slice(0, 4).map(p => (
            <span
              key={p.id}
              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-current/10"
              style={{ background: `hsl(${personHue(p.id)} 60% 45%)` }}
            >
              {initials(p.name)}
            </span>
          ))}
          {peers.length > 4 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground">+{peers.length - 4}</span>}
        </div>
      )}
      {store.canWrite && (
        <span
          className={cn("hidden items-center gap-1 text-[11px] opacity-60 sm:flex", status === "error" && "text-rose-500 opacity-100")}
          title={status === "error" ? tr("Échec de l'enregistrement, nouvel essai au prochain changement", "فشل الحفظ", "Save failed") : undefined}
        >
          {status === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : status === "error" ? <CloudOff className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          {status === "saving" ? tr("Enregistrement…", "جارٍ الحفظ…", "Saving…") : status === "error" ? tr("Non enregistré", "غير محفوظ", "Not saved") : tr("Enregistré", "محفوظ", "Saved")}
        </span>
      )}
    </div>
  );

  return (
    <div dir={dir} className="meet-shell h-[100dvh] bg-[#0b0e14] p-1.5 sm:p-2">
      <WhiteboardBoard
        store={store}
        tr={tr}
        title={title}
        heading={title}
        onRename={isOwner ? rename : undefined}
        onClose={() => {
          void save().finally(props.onBack);
        }}
        backLabel={tr("Fermer", "إغلاق", "Close")}
        headerExtra={extra}
      />
    </div>
  );
}
