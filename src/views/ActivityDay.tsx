/**
 * Élèves connectés un jour donné, classe par classe (ouverte depuis le graphique
 * « Activité des 7 derniers jours » du tableau de bord).
 * Adresse : /activity-day?date=AAAA-MM-JJ&room=<id|all>
 * Données : student_sessions (temps passé, dernière activité) + student_activities
 * (actions de la journée), lues par room_id (règles RLS des profs).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCourses } from "@/contexts/CourseContext";
import { useNavigate, useSearchParams, Link, Navigate } from "@/lib/router";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { loadRoomStudents, type RoomStudent } from "@/lib/roomData";
import { formatMinutes } from "@/lib/classAnalytics";
import { useTr } from "@/components/meet/useTr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, RefreshCw, Users, UserX, Activity, ChevronDown } from "lucide-react";

const ONLINE_MS = 90 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDay = (s: string | null): Date => {
  const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; })() : d;
};

interface SessionRow { student_id: string; room_id: string | null; session_start: string; session_end: string | null; last_activity: string; is_active: boolean }
interface ActRow { student_id: string; room_id: string | null; created_at: string }

interface DayStudent {
  id: string;
  name: string;
  avatar_url?: string | null;
  first: number;
  last: number;
  minutes: number;
  sessions: number;
  actions: number;
  online: boolean;
}

interface RoomDay { id: string; name: string; total: number; active: DayStudent[]; absent: RoomStudent[] }

export default function ActivityDay() {
  const { user } = useAuth();
  const { rooms } = useCourses();
  const params = useSearchParams();
  const navigate = useNavigate();
  const { tr, locale } = useTr();

  const day = useMemo(() => parseDay(params?.get("date") ?? null), [params]);
  const roomParam = params?.get("room") || "all";
  const todayIso = isoDay(new Date());
  const dayIso = isoDay(day);

  const myRooms = useMemo(
    () => rooms.filter(r => r.professor_id === user?.id && !(r as any).archived_at).sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [rooms, user?.id],
  );
  const roomIds = useMemo(
    () => (roomParam === "all" ? myRooms.map(r => r.id) : myRooms.some(r => r.id === roomParam) ? [roomParam] : []),
    [roomParam, myRooms],
  );

  const [data, setData] = useState<RoomDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [openAbsent, setOpenAbsent] = useState<Record<string, boolean>>({});

  const go = (date: string, room = roomParam) => navigate(`/activity-day?date=${date}&room=${encodeURIComponent(room)}`, { replace: true });
  const shift = (n: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + n);
    if (isoDay(d) > todayIso) return;
    go(isoDay(d));
  };

  const load = useCallback(async () => {
    if (!roomIds.length) { setData([]); return; }
    setLoading(true);
    setError(false);
    try {
      const start = day.getTime();
      const endDate = new Date(day);
      endDate.setDate(endDate.getDate() + 1);
      const end = endDate.getTime();
      const startIso = new Date(start).toISOString();
      const endIso = endDate.toISOString();

      const [studentLists, sessRes, actRes] = await Promise.all([
        Promise.all(roomIds.map(id => loadRoomStudents(id))),
        fetchAllRows<SessionRow>(supabase
          .from("student_sessions")
          .select("id, student_id, room_id, session_start, session_end, last_activity, is_active")
          .in("room_id", roomIds)
          .lt("session_start", endIso)
          .gte("last_activity", startIso), { maxRows: 20000 }),
        fetchAllRows<ActRow>(supabase
          .from("student_activities")
          .select("id, student_id, room_id, created_at")
          .in("room_id", roomIds)
          .gte("created_at", startIso)
          .lt("created_at", endIso), { maxRows: 20000 }),
      ]);
      if (sessRes.error) throw sessRes.error;
      if (actRes.error) throw actRes.error;

      const now = Date.now();
      // Clé « classe|élève »
      const acc = new Map<string, DayStudent>();
      const get = (roomId: string, sid: string) => {
        const k = `${roomId}|${sid}`;
        let v = acc.get(k);
        if (!v) { v = { id: sid, name: "", first: Infinity, last: -Infinity, minutes: 0, sessions: 0, actions: 0, online: false }; acc.set(k, v); }
        return v;
      };
      for (const s of sessRes.data || []) {
        if (!s.room_id) continue;
        const a = new Date(s.session_start).getTime();
        const lastAct = new Date(s.last_activity).getTime();
        const b = s.session_end ? Math.max(new Date(s.session_end).getTime(), lastAct) : lastAct;
        const from = Math.max(a, start);
        const to = Math.min(isNaN(b) ? a : b, end, now);
        if (isNaN(from)) continue;
        const v = get(s.room_id, s.student_id);
        v.sessions++;
        if (to > from) v.minutes += (to - from) / 60000;
        v.first = Math.min(v.first, from);
        v.last = Math.max(v.last, Math.min(isNaN(lastAct) ? from : lastAct, end));
        if (s.is_active && now - lastAct < ONLINE_MS) v.online = true;
      }
      for (const r of actRes.data || []) {
        if (!r.room_id) continue;
        const t = new Date(r.created_at).getTime();
        if (isNaN(t)) continue;
        const v = get(r.room_id, r.student_id);
        v.actions++;
        v.first = Math.min(v.first, t);
        v.last = Math.max(v.last, t);
      }

      // Noms des élèves qui ne sont plus dans la liste de la classe
      const known = new Map<string, RoomStudent>();
      studentLists.forEach(list => list.forEach(s => known.set(s.id, s)));
      const missing = Array.from(new Set(Array.from(acc.values()).map(v => v.id))).filter(id => !known.has(id));
      if (missing.length) {
        const { data: extra } = await supabase.from("profiles").select("id, name, avatar_url").in("id", missing);
        (extra || []).forEach((p: any) => known.set(p.id, p));
      }

      const result: RoomDay[] = roomIds.map((roomId, i) => {
        const list = studentLists[i];
        const active: DayStudent[] = [];
        acc.forEach((v, k) => {
          if (!k.startsWith(`${roomId}|`)) return;
          const p = known.get(v.id);
          active.push({ ...v, name: p?.name || tr("Élève", "تلميذ", "Student"), avatar_url: p?.avatar_url });
        });
        active.sort((a, b) => b.last - a.last);
        const activeIds = new Set(active.map(a => a.id));
        return {
          id: roomId,
          name: myRooms.find(r => r.id === roomId)?.name || "",
          total: list.length,
          active,
          absent: list.filter(s => !activeIds.has(s.id)),
        };
      });
      setData(result);
    } catch (e) {
      console.error("activity-day:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [roomIds, day, myRooms, tr]);

  useEffect(() => { if (user) load(); }, [user, load]);

  if (user && user.role !== "professor") return <Navigate to="/dashboard" replace />;

  const time = (t: number) => new Date(t).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const dayLabel = day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const totalActive = (data || []).reduce((n, r) => n + r.active.length, 0);
  const totalStudents = (data || []).reduce((n, r) => n + r.total, 0);
  const totalMinutes = (data || []).reduce((n, r) => n + r.active.reduce((m, s) => m + s.minutes, 0), 0);
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

  return (
    <div className="container mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ms-2 mb-1 gap-1 text-xs">
            <Link to="/dashboard"><ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />{tr("Tableau de bord", "لوحة التحكم", "Dashboard")}</Link>
          </Button>
          <h1 className="text-xl font-semibold sm:text-2xl">{tr("Élèves connectés", "التلاميذ المتصلون", "Students online")}</h1>
          <p className="mt-0.5 text-sm capitalize text-muted-foreground">{dayLabel}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-10 gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{tr("Actualiser", "تحديث", "Refresh")}
        </Button>
      </div>

      {/* ── Jour et classe ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => shift(-1)} aria-label={tr("Jour précédent", "اليوم السابق", "Previous day")}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Input type="date" value={dayIso} max={todayIso} onChange={e => e.target.value && go(e.target.value)} className="h-10 w-[160px]" />
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => shift(1)} disabled={dayIso >= todayIso} aria-label={tr("Jour suivant", "اليوم التالي", "Next day")}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          {dayIso !== todayIso && (
            <Button variant="ghost" size="sm" className="h-10" onClick={() => go(todayIso)}>{tr("Aujourd'hui", "اليوم", "Today")}</Button>
          )}
        </div>
        <Select value={roomIds.length === 1 && roomParam !== "all" ? roomParam : "all"} onValueChange={v => go(dayIso, v)}>
          <SelectTrigger className="h-10 w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tr("Toutes mes classes", "جميع أقسامي", "All my classes")}</SelectItem>
            {myRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* ── Résumé ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{tr("Élèves connectés", "تلاميذ متصلون", "Students online")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums" dir="ltr">{data ? totalActive : "…"}<span className="text-base font-medium text-muted-foreground"> / {data ? totalStudents : "…"}</span></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{tr("Temps total", "الوقت الإجمالي", "Total time")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{data ? formatMinutes(totalMinutes) : "…"}</p>
        </CardContent></Card>
        <Card className="col-span-2 sm:col-span-1"><CardContent className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5" />{tr("Temps moyen par élève connecté", "متوسط الوقت لكل تلميذ", "Avg time per student")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{data ? formatMinutes(totalActive ? totalMinutes / totalActive : 0) : "…"}</p>
        </CardContent></Card>
      </div>

      {error && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {tr("Impossible de charger les données.", "تعذر تحميل البيانات.", "Could not load data.")}
          <Button variant="link" onClick={load}>{tr("Réessayer", "إعادة المحاولة", "Retry")}</Button>
        </CardContent></Card>
      )}

      {!data && loading && (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin" />{tr("Chargement…", "جارٍ التحميل…", "Loading…")}</CardContent></Card>
      )}

      {data && data.length === 0 && !loading && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{tr("Aucune classe.", "لا توجد أقسام.", "No classes.")}</CardContent></Card>
      )}

      {/* ── Par classe ── */}
      {data?.map(r => (
        <Card key={r.id}>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{r.name}</CardTitle>
              <CardDescription className="mt-1" dir="auto">
                {tr(`${r.active.length} élève(s) connecté(s) sur ${r.total}`, `${r.active.length} من ${r.total} تلميذ متصل`, `${r.active.length} of ${r.total} students online`)}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
              <Link to={`/rooms/${r.id}/students-activities`}>{tr("Suivi", "التتبع", "Tracking")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {r.active.length === 0 ? (
              <p className="rounded-xl bg-muted/40 p-4 text-center text-sm text-muted-foreground">{tr("Aucun élève connecté ce jour-là.", "لم يتصل أي تلميذ في هذا اليوم.", "No student online that day.")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-start text-xs text-muted-foreground">
                      <th className="py-2 pe-3 text-start font-medium">{tr("Élève", "التلميذ", "Student")}</th>
                      <th className="px-3 py-2 text-start font-medium">{tr("Première connexion", "أول اتصال", "First seen")}</th>
                      <th className="px-3 py-2 text-start font-medium">{tr("Dernière activité", "آخر نشاط", "Last activity")}</th>
                      <th className="px-3 py-2 text-start font-medium">{tr("Temps passé", "الوقت المستغرق", "Time spent")}</th>
                      <th className="ps-3 py-2 text-start font-medium">{tr("Connexions", "الاتصالات", "Sessions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.active.map(s => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pe-3">
                          <div className="flex items-center gap-2.5">
                            <div className="relative shrink-0">
                              <Avatar className="h-8 w-8"><AvatarImage src={s.avatar_url || undefined} /><AvatarFallback className="text-[11px]">{initials(s.name)}</AvatarFallback></Avatar>
                              {s.online && dayIso === todayIso && <span className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />}
                            </div>
                            <span className="truncate font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted-foreground" dir="ltr">{isFinite(s.first) ? time(s.first) : "—"}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {s.online && dayIso === todayIso
                            ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />{tr("En ligne", "متصل الآن", "Online")}</span>
                            : <span dir="ltr">{isFinite(s.last) ? time(s.last) : "—"}</span>}
                        </td>
                        <td className="px-3 py-2 tabular-nums font-medium">{s.minutes >= 1 ? formatMinutes(s.minutes) : "< 1 min"}</td>
                        <td className="ps-3 py-2 tabular-nums text-muted-foreground">{s.sessions || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {r.absent.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setOpenAbsent(o => ({ ...o, [r.id]: !o[r.id] }))}
                  className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-expanded={!!openAbsent[r.id]}
                >
                  <UserX className="h-3.5 w-3.5" />
                  {tr(`Non connectés (${r.absent.length})`, `غير متصلين (${r.absent.length})`, `Not online (${r.absent.length})`)}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openAbsent[r.id] ? "rotate-180" : ""}`} />
                </button>
                {openAbsent[r.id] && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.absent.map(s => <span key={s.id} className="rounded-full bg-muted px-2.5 py-1 text-xs">{s.name || s.email}</span>)}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
