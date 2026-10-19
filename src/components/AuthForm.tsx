import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Eye, EyeOff, ArrowLeft, GraduationCap, MailCheck, RefreshCw, Presentation, KeyRound, Mail, Phone, MessageCircle, LifeBuoy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { DEFAULT_APP_SETTINGS, pickText, type I18nText, type Lang } from "@/lib/appSettings";
import { BrandLogo, useBrand } from "@/components/AppBrand";

const USER_TYPE_KEY = "auth-last-user-type";

function readLastUserType(): "student" | "professor" | null {
  try {
    const v = localStorage.getItem(USER_TYPE_KEY);
    return v === "student" || v === "professor" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Exécute un appel de connexion d'AuthContext en capturant le message d'erreur qu'il
 * affiche par toast (AuthContext ne lève pas d'exception) pour l'afficher aussi sous le formulaire.
 */
async function captureToastError<T>(fn: () => Promise<T>): Promise<{ result: T | undefined; message: string | null }> {
  let message: string | null = null;
  const t = toast as any;
  const original = t.error;
  t.error = (msg: any, ...rest: any[]) => {
    if (message === null) message = typeof msg === "string" ? msg : null;
    return original(msg, ...rest);
  };
  try {
    const result = await fn();
    return { result, message };
  } catch (err: any) {
    return { result: undefined, message: (err && err.message) || "Login failed" };
  } finally {
    t.error = original;
  }
}

/** Nom (et logo) de l'application en tête du formulaire, selon la personnalisation. */
const BrandHeader = ({ language }: { language: string }) => {
  const brand = useBrand(language);
  return (
    <div className="text-center">
      {brand.logoUrl && (
        <div className="mb-2 flex justify-center">
          <BrandLogo logoUrl={brand.logoUrl} alt={brand.appName} imgClassName="h-14 w-14 rounded-2xl" className="hidden" />
        </div>
      )}
      <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent break-words">
        {brand.displayName}
      </h2>
      {brand.customTagline && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{brand.customTagline}</p>}
    </div>
  );
};

/** « Besoin d'aide ? » : coordonnées de l'établissement (Personnalisation → Textes), si renseignées. */
export const LoginHelpContact = ({ language }: { language: string }) => {
  const { settings } = useAppSettings();
  const tx = settings.texts || DEFAULT_APP_SETTINGS.texts;
  const email = (tx.contactEmail || "").trim();
  const phone = (tx.contactPhone || "").trim();
  const waDigits = (tx.contactWhatsapp || "").replace(/[^0-9]/g, "");
  if (!email && !phone && !waDigits) return null;
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const linkCls = "inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors";
  return (
    <div className="mt-4 w-full max-w-md rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-center" dir={language === "ar" ? "rtl" : "ltr"}>
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
        {tr("Besoin d'aide ?", "تحتاج مساعدة؟", "Need help?")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {email && (
          <a href={`mailto:${email}`} className={linkCls} dir="ltr">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="break-all">{email}</span>
          </a>
        )}
        {phone && (
          <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className={linkCls} dir="ltr">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {phone}
          </a>
        )}
        {waDigits && (
          <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" className={linkCls}>
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
};

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [pasteLinkMode, setPasteLinkMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserTypeState] = useState<"student" | "professor" | null>(null);
  const [lastUserType] = useState<"student" | "professor" | null>(readLastUserType);
  const [formError, setFormError] = useState<string | null>(null);
  const setUserType = (v: "student" | "professor" | null) => {
    setUserTypeState(v);
    setFormError(null);
    if (v) {
      try { localStorage.setItem(USER_TYPE_KEY, v); } catch { /* stockage indisponible */ }
    }
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("professor");
  const [loading, setLoading] = useState(false);

  const { login, register, resetPassword, loginStudent, verifyOtp, resendOtp } = useAuth();
  const { t, language } = useLanguage();
  const tr = (fr: string, ar: string, en: string) => (language === "ar" ? ar : language === "en" ? en : fr);
  const isRtl = language === "ar";
  const { settings: appSettings } = useAppSettings();
  const lang = (language === "ar" || language === "en" ? language : "fr") as Lang;
  /** Texte de la personnalisation, ou texte d'origine quand il est vide / inchangé. */
  const customText = (value: I18nText | undefined, def: I18nText, fallback: string) => {
    const v = pickText(value, lang);
    return v && v !== pickText(def, lang) ? v : fallback;
  };
  const loginTitle = customText(appSettings.texts?.loginTitle, DEFAULT_APP_SETTINGS.texts.loginTitle, t("Welcome"));
  const loginSubtitle = customText(appSettings.texts?.loginSubtitle, DEFAULT_APP_SETTINGS.texts.loginSubtitle, t("Choose your account type to continue"));
  const studentHelp = customText(
    appSettings.texts?.loginHelpStudent,
    DEFAULT_APP_SETTINGS.texts.loginHelpStudent,
    tr(
      "Mot de passe oublié ? Demande à ton professeur de le réinitialiser.",
      "نسيت كلمة المرور؟ اطلب من أستاذك إعادة تعيينها.",
      "Forgot your password? Ask your teacher to reset it."
    )
  );

  // Messages d'erreur d'AuthContext (anglais / français) → texte clair dans la langue courante
  const friendlyLoginError = (msg: string | null): string => {
    const m = msg || "";
    if (/invalid (email|username) or password/i.test(m) || /invalid login credentials/i.test(m)) {
      return userType === "student"
        ? tr("Code Massar ou mot de passe incorrect.", "رمز مسار أو كلمة المرور غير صحيحة.", "Incorrect Massar code or password.")
        : tr("E-mail ou mot de passe incorrect.", "البريد الإلكتروني أو كلمة المرور غير صحيحة.", "Incorrect email or password.");
    }
    if (/suspendu|banned/i.test(m)) return tr("Compte suspendu : contactez l'administration.", "الحساب موقوف: يرجى الاتصال بالإدارة.", "Account suspended: please contact the administration.");
    if (/not confirmed/i.test(m)) return tr("E-mail non confirmé. Saisissez le code de vérification.", "البريد الإلكتروني غير مؤكد. أدخل رمز التحقق.", "Email not confirmed. Please enter the verification code.");
    if (!m || /login failed/i.test(m)) return tr("Connexion impossible. Vérifiez votre connexion Internet et réessayez.", "تعذر تسجيل الدخول. تحقق من اتصالك بالإنترنت وأعد المحاولة.", "Unable to sign in. Check your internet connection and try again.");
    return m;
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error(tr("Saisissez le code ou le lien de confirmation", "أدخل رمز أو رابط التأكيد", "Please enter the confirmation code or link"));
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(email, otpCode.trim());
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending || !email) return;
    setResending(true);
    try {
      const success = await resendOtp(email);
      if (success) {
        setResendCooldown(30);
      }
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    try {
      if (isResetMode) {
        await resetPassword(email);
        setIsResetMode(false);
        setEmail("");
      } else if (isLogin) {
        const { result, message } = await captureToastError(() =>
          userType === "student" ? loginStudent(username, password) : login(email, password, "professor")
        );
        if (!result) setFormError(friendlyLoginError(message));
      } else {
        const assignedRole: UserRole = userType === "professor" ? "professor" : role;
        const success = await register(email, password, name, assignedRole);
        if (success) {
          // Switch to OTP verification mode
          setIsOtpMode(true);
          setResendCooldown(30);
          setPassword("");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchToResetMode = () => {
    setIsResetMode(true);
    setPassword("");
  };

  const switchBackToLogin = () => {
    setIsResetMode(false);
    setIsOtpMode(false);
    setOtpCode("");
  };

  const getTitle = () => {
    if (isOtpMode) return t("Verify Your Email");
    if (isResetMode) return t("Reset Password");
    return isLogin ? t("Welcome Back") : t("Create Account");
  };

  const getDescription = () => {
    if (isOtpMode) return t("Enter the 6-digit confirmation code sent to your email");
    if (isResetMode) return t("Enter your email to receive a password reset link");
    return isLogin 
      ? t("Sign in to your account to continue") 
      : t("Create a new account to get started");
  };

  const getButtonText = () => {
    if (loading) return isResetMode ? t("Sending...") : isLogin ? t("Signing In...") : t("Creating Account...");
    if (isResetMode) return t("Send Reset Link");
    return isLogin ? t("Sign In") : t("Create Account");
  };

  // If no user type selected, show selection
  if (!userType && !isResetMode && !isOtpMode) {
    // L'élève est le cas le plus fréquent : bouton principal, sauf si le dernier choix était « Professeur »
    const professorFirst = lastUserType === "professor";
    const studentBtn = (
      <Button
        key="student"
        type="button"
        onClick={() => {
          setUserType("student");
          setRole("student");
        }}
        className="w-full h-14 flex items-center justify-center gap-2.5 text-base"
        variant={professorFirst ? "outline" : "default"}
      >
        <GraduationCap className="h-5 w-5" />
        {t("Student")}
      </Button>
    );
    const professorBtn = (
      <Button
        key="professor"
        type="button"
        onClick={() => {
          setUserType("professor");
          setRole("professor");
        }}
        className={cn("w-full flex items-center justify-center gap-2.5", professorFirst ? "h-14 text-base" : "h-12")}
        variant={professorFirst ? "default" : "outline"}
      >
        <Presentation className="h-5 w-5" />
        {t("Professor")}
      </Button>
    );
    return (
      <div className="min-h-[calc(100vh-4.5rem)] flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="mb-4">
              <BrandHeader language={language} />
            </div>
            <CardTitle className="text-2xl text-center">{loginTitle}</CardTitle>
            <CardDescription className="text-center whitespace-pre-line">
              {loginSubtitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {professorFirst ? [professorBtn, studentBtn] : [studentBtn, professorBtn]}
          </CardContent>
        </Card>
        <LoginHelpContact language={language} />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4 relative min-h-[40px]">
            {(isResetMode || isOtpMode || userType) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isOtpMode) {
                    setIsOtpMode(false);
                    setOtpCode("");
                  } else if (isResetMode) {
                    switchBackToLogin();
                  } else {
                    setUserType(null);
                    setEmail("");
                    setUsername("");
                    setPassword("");
                  }
                }}
                className="absolute left-0 top-0 h-10 w-10 p-0 rtl:left-auto rtl:right-0"
                aria-label={tr("Retour", "رجوع", "Back")}
                title={tr("Retour", "رجوع", "Back")}
              >
                <ArrowLeft className={cn("h-5 w-5", isRtl && "rotate-180")} />
              </Button>
            )}
            <div className="px-10">
              <BrandHeader language={language} />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {getTitle()} {!isOtpMode && (userType === "student" ? `- ${t("Student")}` : userType === "professor" ? `- ${t("Professor")}` : "")}
          </CardTitle>
          <CardDescription className="text-center">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOtpMode ? (
            <div className="space-y-5">
              <div className="flex flex-col items-center justify-center text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                  <MailCheck className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("Un email de confirmation a été envoyé à :")}
                </p>
                <div className="font-semibold text-sm bg-muted px-3 py-1 rounded-full text-foreground max-w-full truncate">
                  {email}
                </div>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground space-y-1 border">
                <p className="font-medium text-foreground">{t("Deux façons de confirmer :")}</p>
                <p>{t("1. Cliquez sur le lien Confirm your mail dans votre email.")}</p>
                <p>{t("2. Ou entrez votre code / collez le lien ci-dessous :")}</p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {!pasteLinkMode ? (
                  <div className="flex flex-col items-center space-y-2">
                    <Label htmlFor="otp-input" className="text-sm font-medium">
                      {t("Code à 6 chiffres")}
                    </Label>
                    <div className="flex justify-center py-2">
                      <InputOTP
                        id="otp-input"
                        maxLength={6}
                        value={otpCode}
                        onChange={(value) => setOtpCode(value)}
                        disabled={loading}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                        </InputOTPGroup>
                        <InputOTPSeparator />
                        <InputOTPGroup>
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="link-input" className="text-sm font-medium">
                      {t("Lien ou token de confirmation")}
                    </Label>
                    <Input
                      id="link-input"
                      placeholder={t("Collez le lien ou token reçu par email...")}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                )}

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setPasteLinkMode(!pasteLinkMode);
                      setOtpCode("");
                    }}
                    className="text-xs text-muted-foreground hover:text-primary p-0 h-auto"
                  >
                    {pasteLinkMode
                      ? t("← Revenir au code à 6 chiffres")
                      : t("Votre email contient un lien ? Cliquez ici pour le coller")}
                  </Button>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || otpCode.trim().length < 6}
                >
                  {loading ? t("Vérification en cours...") : t("Confirmer")}
                </Button>

                <div className="flex flex-col items-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || resending}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", resending && "animate-spin")} />
                    {resendCooldown > 0
                      ? tr(`Renvoyer le mail dans ${resendCooldown} s`, `إعادة الإرسال بعد ${resendCooldown} ث`, `Resend email in ${resendCooldown}s`)
                      : t("Vous n'avez rien reçu ? Renvoyer")}
                  </Button>

                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={switchBackToLogin}
                    className="text-xs"
                  >
                    {t("Retour à la connexion")}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {userType === "student" && isLogin ? (
                <div className="space-y-2">
                  <Label htmlFor="username">{t("Code Massar")}</Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    dir="ltr"
                    placeholder={t("Enter your Code Massar")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">{t("Email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete={isResetMode ? "email" : "username"}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={t("Enter your email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              )}

              {!isResetMode && (
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {tr("Mot de passe", "كلمة المرور", "Password")}
                    {userType === "student" && isLogin && (
                      <span className="font-normal text-muted-foreground">
                        {" "}{tr("(donné par ton professeur)", "(يمنحها لك أستاذك)", "(given by your teacher)")}
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder={t("Enter your password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10 rtl:pr-3 rtl:pl-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full min-w-[40px] px-3 hover:bg-transparent rtl:right-auto rtl:left-0"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? t("Hide password") : t("Show password")}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {!isLogin && !isResetMode && userType === "professor" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">{t("Full Name")}</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder={t("Enter your full name")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">{t("Role")}</Label>
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/60 text-sm font-medium text-primary">
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <span>{t("Professor")}</span>
                    </div>
                  </div>
                </>
              )}

              {formError && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              )}

              <Button type="submit" className="w-full h-11" disabled={loading}>
                {getButtonText()}
              </Button>

              {userType === "student" && isLogin && !isResetMode && (
                <p className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="whitespace-pre-line">{studentHelp}</span>
                </p>
              )}

              {!isResetMode && (
                <div className="space-y-4">
                  {userType === "professor" && (
                    <div className="flex items-center justify-between text-xs">
                      <Button
                        type="button"
                        variant="link"
                        onClick={switchToResetMode}
                        className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
                      >
                        {t("Forgot your password?")}
                      </Button>

                    </div>
                  )}

                  {userType === "professor" && (
                    <p className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                      {language === "ar"
                        ? "حسابات الأساتذة تُنشأ من طرف الإدارة. للحصول على حساب، يرجى الاتصال بالإدارة."
                        : language === "en"
                        ? "Teacher accounts are created by the administration. Please contact us to get one."
                        : "Les comptes professeurs sont créés par l'administration. Contactez-nous pour obtenir un compte."}
                    </p>
                  )}
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
      <LoginHelpContact language={language} />
    </div>
  );
};

export default AuthForm;
