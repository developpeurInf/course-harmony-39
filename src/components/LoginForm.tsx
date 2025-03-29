
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, BookOpen } from "lucide-react";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        navigate("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // For demo purposes, let's add helper buttons
  const loginAsProfessor = async () => {
    setEmail("smith@university.edu");
    setPassword("password");
    setIsLoading(true);
    
    try {
      const success = await login("smith@university.edu", "password");
      if (success) {
        navigate("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginAsStudent = async () => {
    setEmail("john@university.edu");
    setPassword("password");
    setIsLoading(true);
    
    try {
      const success = await login("john@university.edu", "password");
      if (success) {
        navigate("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-muted/30">
      <Card className="w-[350px] shadow-lg animate-fade-in">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Course Harmony</CardTitle>
          <CardDescription className="text-center">
            Login to access your academic portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center mb-2">
            Demo Logins
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="w-full text-xs"
              onClick={loginAsProfessor}
              disabled={isLoading}
            >
              <GraduationCap className="mr-1 h-4 w-4" />
              Professor
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs"
              onClick={loginAsStudent}
              disabled={isLoading}
            >
              <BookOpen className="mr-1 h-4 w-4" />
              Student
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginForm;
