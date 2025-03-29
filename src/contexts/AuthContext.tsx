
import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

// Types for our users
export type UserRole = "professor" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// Mock professor and students data
const mockProfessor: User = {
  id: "p1",
  name: "Dr. Smith",
  email: "smith@university.edu",
  role: "professor"
};

const mockStudents: User[] = [
  {
    id: "s1",
    name: "John Doe",
    email: "john@university.edu",
    role: "student"
  },
  {
    id: "s2",
    name: "Jane Smith",
    email: "jane@university.edu",
    role: "student"
  },
  {
    id: "s3",
    name: "Mike Johnson",
    email: "mike@university.edu",
    role: "student"
  }
];

// All users combined for login
const allUsers = [mockProfessor, ...mockStudents];

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getStudents: () => User[];
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check for saved login
    const savedUser = localStorage.getItem("courseHarmonyUser");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // For demo, we'll just check if the email matches one of our mock users
    // In a real app, this would validate with a backend service
    const foundUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (foundUser) {
      setUser(foundUser);
      setIsLoggedIn(true);
      localStorage.setItem("courseHarmonyUser", JSON.stringify(foundUser));
      toast.success(`Welcome, ${foundUser.name}!`);
      return true;
    } else {
      toast.error("Invalid email or password");
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem("courseHarmonyUser");
    toast.info("You have been logged out");
  };

  const getStudents = () => {
    // In a real app, this would fetch from a backend
    return mockStudents;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getStudents, isLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
