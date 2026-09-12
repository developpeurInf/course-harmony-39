import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Eye, EyeOff, ArrowLeft, GraduationCap, MailCheck, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [pasteLinkMode, setPasteLinkMode] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"student" | "professor" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("professor");
  const [loading, setLoading] = useState(false);

  const { login, register, resetPassword, loginStudent, verifyOtp, resendOtp } = useAuth();
  const { t, language } = useLanguage();

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
      toast.error("Please enter the confirmation code or link");
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

    try {
      if (isResetMode) {
        await resetPassword(email);
        setIsResetMode(false);
        setEmail("");
      } else if (isLogin) {
        if (userType === "student") {
          await loginStudent(username, password);
        } else {
          await login(email, password, "professor");
        }
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {language === "ar" ? "???????? ????????" : "MAATAOUI Academy"}
              </h2>
            </div>
            <CardTitle className="text-2xl text-center">{t("Welcome")}</CardTitle>
            <CardDescription className="text-center">
              {t("Choose your account type to continue")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => {
                setUserType("professor");
                setRole("professor");
              }} 
              className="w-full h-12 flex items-center justify-center gap-2"
              variant="default"
            >
              <GraduationCap className="h-5 w-5" />
              {t("I'm a Professor")}
            </Button>
            <Button 
              onClick={() => {
                setUserType("student");
                setRole("student");
              }} 
              className="w-full h-12"
              variant="outline"
            >
              {t("I'm a Student")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4 relative">
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
                className="absolute left-0 top-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {language === "ar" ? "???????? ????????" : "MAATAOUI Academy"}
              </h2>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {getTitle()} {!isOtpMode && (userType === "student" ? "- Student" : userType === "professor" ? "- Professor" : "")}
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
                      ? (t(`Renvoyer le mail dans ${resendCooldown}s`))
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
                  <Label htmlFor="username">{t("Username")}</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder={t("Enter your username")}
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
                    type="email"
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
                    {userType === "student" && isLogin ? t("Temporary Password") : t("Password")}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={userType === "student" && isLogin ? t("Enter your temporary password") : t("Enter your password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
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

              <Button type="submit" className="w-full" disabled={loading}>
                {getButtonText()}
              </Button>

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

                      {isLogin && (
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => {
                            if (!email) {
                              toast.info("Please enter your email first");
                              return;
                            }
                            setIsOtpMode(true);
                            setResendCooldown(15);
                          }}
                          className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
                        >
                          {t("Have a confirmation code?")}
                        </Button>
                      )}
                    </div>
                  )}

                  {userType === "professor" && (
                    <>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">
                            {t("or")}
                          </span>
                        </div>
                      </div>

                      <div className="text-center">
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => setIsLogin(!isLogin)}
                          className="text-sm"
                        >
                          {isLogin 
                            ? t("Don't have an account? Sign up") 
                            : t("Already have an account? Sign in")
                          }
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthForm;
