import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, UserRole } from "@/contexts/AuthContext";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userType, setUserType] = useState<"student" | "professor" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(false);

  const { login, register, resetPassword, loginStudent } = useAuth();
  const { t } = useLanguage();

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
          await login(email, password);
        }
      } else {
        const success = await register(email, password, name, role);
        if (success) {
          // Switch to login mode after successful registration
          setIsLogin(true);
          setPassword("");
          setName("");
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
    setEmail("");
  };

  const getTitle = () => {
    if (isResetMode) return "Reset Password";
    return isLogin ? "Welcome Back" : "Create Account";
  };

  const getDescription = () => {
    if (isResetMode) return "Enter your email to receive a password reset link";
    return isLogin 
      ? "Sign in to your account to continue" 
      : "Create a new account to get started";
  };

  const getButtonText = () => {
    if (loading) return isResetMode ? "Sending..." : isLogin ? "Signing In..." : "Creating Account...";
    if (isResetMode) return "Send Reset Link";
    return isLogin ? "Sign In" : "Create Account";
  };

  // If no user type selected, show selection
  if (!userType && !isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                MAATAOUI Academy
              </h2>
            </div>
            <CardTitle className="text-2xl text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Choose your account type to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => setUserType("professor")} 
              className="w-full h-12"
              variant="default"
            >
              I'm a Professor
            </Button>
            <Button 
              onClick={() => setUserType("student")} 
              className="w-full h-12"
              variant="outline"
            >
              I'm a Student
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
          <div className="flex items-center justify-center mb-4">
            {(isResetMode || userType) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (isResetMode) {
                    switchBackToLogin();
                  } else {
                    setUserType(null);
                    setEmail("");
                    setUsername("");
                    setPassword("");
                  }
                }}
                className="absolute left-4 top-4"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="text-center">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              MAATAOUI Academy
            </h2>
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            {getTitle()} {userType === "student" ? "- Student" : userType === "professor" ? "- Professor" : ""}
          </CardTitle>
          <CardDescription className="text-center">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {userType === "student" && isLogin ? (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
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
                    {userType === "student" && isLogin ? "Temporary Password" : "Password"}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={userType === "student" && isLogin ? "Enter your temporary password" : "Enter your password"}
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
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value="professor" onValueChange={(value: UserRole) => setRole(value)}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Professor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professor">Professor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {getButtonText()}
            </Button>

            {!isResetMode && (
              <div className="space-y-4">
                {userType === "professor" && (
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      onClick={switchToResetMode}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      Forgot your password?
                    </Button>
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
                          or
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
                          ? "Don't have an account? Sign up" 
                          : "Already have an account? Sign in"
                        }
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthForm;