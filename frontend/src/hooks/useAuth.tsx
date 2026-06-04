import type { ReactNode } from "react";
import { useState, useCallback, createContext, useContext, type Context } from "react";
import { authApi } from "../api";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  checkAuth: () => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null) as Context<AuthContextType>;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return false;
    }
    try {
      const res = await authApi.me();
      if (res.code === 200 && res.data) {
        setUser(res.data);
        setLoading(false);
        return true;
      }
      localStorage.removeItem("token");
      setLoading(false);
      return false;
    } catch {
      localStorage.removeItem("token");
      setLoading(false);
      return false;
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    if (res.code === 200 && res.data) {
      localStorage.setItem("token", res.data.access_token);
      await checkAuth();
      return true;
    }
    throw new Error(res.message);
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await authApi.register({ username, email, password });
    if (res.code === 201 && res.data) {
      return true;
    }
    throw new Error(res.message);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const providerValue: AuthContextType = {
    user,
    loading,
    checkAuth,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={providerValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
