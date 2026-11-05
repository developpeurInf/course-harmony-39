import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { useAccess } from "@/contexts/AccessContext";
import { useT } from "./adminShared";

const mfa = () => (supabase.auth as any).mfa;

interface Enroll {
  id: string;
  qr: string;
  secret: string;
}

/** Ajout d'une application d'authentification (Google Authenticator, Microsoft Authenticator…) */
function EnrollTotp({ onDone }: { onDone: () => void }) {
  const { L } = useT();
  const [enroll, setEnroll] = useState<Enroll | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    // facteurs non vérifiés d'un essai précédent : on les retire
    const { data: list } = await mfa().listFactors();
    for (const f of (list?.all || []).filter((f: any) => f.status !== "verified")) await mfa().unenroll({ factorId: f.id });
    const { data, error } = await mfa().enroll({ factorType: "totp", friendlyName: `Admin ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verify = async () => {
    if (!enroll) return;
    setBusy(true);
    const { data: ch, error: e1 } = await mfa().challenge({ factorId: enroll.id });
    const { error: e2 } = e1 ? { error: e1 } : await mfa().verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (e2) {
      toast.error(L("Code incorrect, réessayez.", "رمز غير صحيح، أعد المحاولة.", "Wrong code, try again."));
      return;
    }
    toast.success(L("Double authentification activée", "تم تفعيل التحقق بخطوتين", "Two-factor authentication enabled"));
    onDone();
  };

  if (!enroll) {
    return (
      <Button onClick={start} disabled={busy} className="gap-1.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {L("Configurer l'application d'authentification", "إعداد تطبيق المصادقة", "Set up the authenticator app")}
      </Button>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {L(
          "Scannez ce code avec Google Authenticator ou Microsoft Authenticator, puis saisissez le code à 6 chiffres.",
          "امسح هذا الرمز بتطبيق Google Authenticator أو Microsoft Authenticator ثم أدخل الرمز المكون من 6 أرقام.",
          "Scan this code with Google Authenticator or Microsoft Authenticator, then enter the 6-digit code."
        )}
      </p>
      <img src={enroll.qr} alt="QR code" className="h-44 w-44 rounded-lg border bg-white p-2" />
      <p className="break-all text-xs text-muted-foreground">{L("Clé manuelle : ", "المفتاح اليدوي: ", "Manual key: ")}<span className="font-mono">{enroll.secret}</span></p>
      <div className="flex gap-2">
        <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} className="w-32 font-mono tracking-widest" aria-label={L("Code", "الرمز", "Code")} />
        <Button onClick={verify} disabled={busy || code.length !== 6}>{L("Vérifier", "تحقق", "Verify")}</Button>
      </div>
    </div>
  );
}

/** Saisie du code à 6 chiffres pour passer la session en niveau aal2 */
function VerifyTotp({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const { L } = useT();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    const { data: ch, error: e1 } = await mfa().challenge({ factorId });
    const { error: e2 } = e1 ? { error: e1 } : await mfa().verify({ factorId, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (e2) {
      toast.error(L("Code incorrect, réessayez.", "رمز غير صحيح، أعد المحاولة.", "Wrong code, try again."));
      return;
    }
    onDone();
  };
  return (
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); verify(); }}>
      <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} className="w-32 font-mono tracking-widest" aria-label={L("Code", "الرمز", "Code")} />
      <Button type="submit" disabled={busy || code.length !== 6}>{L("Valider", "تأكيد", "Confirm")}</Button>
    </form>
  );
}

function useAal() {
  const [state, setState] = useState<{ current: string; next: string; factor: string | null } | null>(null);
  const refresh = useCallback(async () => {
    try {
      const [{ data: aal }, { data: list }] = await Promise.all([mfa().getAuthenticatorAssuranceLevel(), mfa().listFactors()]);
      const verified = (list?.totp || []).find((f: any) => f.status === "verified");
      setState({ current: aal?.currentLevel || "aal1", next: aal?.nextLevel || "aal1", factor: verified?.id || null });
    } catch {
      setState({ current: "aal1", next: "aal1", factor: null });
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { state, refresh };
}

/**
 * Double authentification obligatoire (Personnalisation > Sécurité) : la base
 * refuse les droits d'administration tant que la session n'est pas en aal2.
 */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const { L } = useT();
  const { settings } = useAppSettings();
  const { refresh: reloadAccess } = useAccess();
  const { state, refresh } = useAal();
  const required = !!settings.security?.requireAdminMfa;

  if (!required) return <>{children}</>;
  if (!state) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (state.current === "aal2") return <>{children}</>;

  const done = async () => {
    await supabase.auth.refreshSession();
    await refresh();
    await reloadAccess();
  };
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-xl border bg-card p-6">
      <ShieldCheck className="h-8 w-8 text-primary" />
      <h1 className="text-lg font-semibold">{L("Double authentification", "التحقق بخطوتين", "Two-factor authentication")}</h1>
      <p className="text-sm text-muted-foreground">
        {state.factor
          ? L("Saisissez le code affiché dans votre application d'authentification.", "أدخل الرمز الظاهر في تطبيق المصادقة.", "Enter the code shown in your authenticator app.")
          : L("L'administration exige une double authentification. Configurez-la pour continuer.", "تتطلب الإدارة التحقق بخطوتين. قم بإعداده للمتابعة.", "Administration requires two-factor authentication. Set it up to continue.")}
      </p>
      {state.factor ? <VerifyTotp factorId={state.factor} onDone={done} /> : <EnrollTotp onDone={done} />}
    </div>
  );
}

/** Carte « Ma double authentification » (page Équipe) */
export function MfaSetupCard() {
  const { L } = useT();
  const { state, refresh } = useAal();
  const [adding, setAdding] = useState(false);

  const remove = async () => {
    if (!state?.factor) return;
    const { error } = await mfa().unenroll({ factorId: state.factor });
    if (error) toast.error(error.message);
    else {
      toast.success(L("Double authentification retirée", "تمت إزالة التحقق بخطوتين", "Two-factor authentication removed"));
      refresh();
    }
  };

  return (
    <section className="mb-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-5 w-5 ${state?.factor ? "text-emerald-600" : "text-muted-foreground"}`} />
          <div>
            <p className="text-sm font-semibold">{L("Ma double authentification", "التحقق بخطوتين الخاص بي", "My two-factor authentication")}</p>
            <p className="text-xs text-muted-foreground">
              {state?.factor ? L("Activée sur ce compte.", "مفعل على هذا الحساب.", "Enabled on this account.") : L("Non configurée.", "غير مُعد.", "Not set up.")}
            </p>
          </div>
        </div>
        {state?.factor ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={remove}><Trash2 className="h-4 w-4" />{L("Retirer", "إزالة", "Remove")}</Button>
        ) : !adding ? (
          <Button size="sm" onClick={() => setAdding(true)}>{L("Configurer", "إعداد", "Set up")}</Button>
        ) : null}
      </div>
      {adding && !state?.factor && (
        <div className="mt-3 border-t pt-3">
          <Label className="sr-only">TOTP</Label>
          <EnrollTotp onDone={() => { setAdding(false); refresh(); }} />
        </div>
      )}
    </section>
  );
}
