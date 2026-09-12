import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, setAccessToken, refreshAccessToken } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { User } from "../types";

interface AuthContextValue {
  user: User | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  // On hard refresh the in-memory access token is gone. Try to silently
  // re-establish a session from the HttpOnly refresh cookie before
  // rendering any protected route.
  useEffect(() => {
    (async () => {
      const token = await refreshAccessToken();
      if (token) {
        try {
          const me = await api.get("/auth/me");
          setUser(me.data);
          connectSocket(token);
        } catch {
          setAccessToken(null);
        }
      }
      setBooting(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    setAccessToken(res.data.accessToken);
    setUser(res.data.user);
    connectSocket(res.data.accessToken);
  }

  async function logout() {
    await api.post("/auth/logout");
    setAccessToken(null);
    setUser(null);
    disconnectSocket();
  }

  return (
    <AuthContext.Provider value={{ user, booting, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
