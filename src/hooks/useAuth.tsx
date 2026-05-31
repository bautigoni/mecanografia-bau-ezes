import { createContext, useContext, useMemo, useState } from "react";
import type { ActiveUser, Role } from "../types";
import { authenticate, authenticateAny, demoLogin, ensureSeedData, getActiveUser, setActiveUser } from "../utils/storage";

interface AuthContextValue {
  user: ActiveUser | null;
  /** Role-agnostic login — discovers the role from credentials automatically.
   *  This is the preferred path for students (no role picker needed). */
  loginAny: (username: string, password: string) => ActiveUser | null;
  login: (role: Role, username: string, password: string) => ActiveUser | null;
  loginDemo: (role: Role) => ActiveUser;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  ensureSeedData();
  const [user, setUser] = useState<ActiveUser | null>(() => getActiveUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loginAny: (username, password) => {
        const nextUser = authenticateAny(username, password);
        if (nextUser) {
          setActiveUser(nextUser);
          setUser(nextUser);
        }
        return nextUser;
      },
      login: (role, username, password) => {
        const nextUser = authenticate(role, username, password);
        if (nextUser) {
          setActiveUser(nextUser);
          setUser(nextUser);
        }

        return nextUser;
      },
      loginDemo: (role) => {
        const nextUser = demoLogin(role);
        setActiveUser(nextUser);
        setUser(nextUser);
        return nextUser;
      },
      logout: () => {
        setActiveUser(null);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
