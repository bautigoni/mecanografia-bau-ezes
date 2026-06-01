import { createContext, useContext, useMemo, useState } from "react";
import type { ActiveUser, Role } from "../types";
import { authenticate, authenticateAny, demoLogin, ensureSeedData, getActiveUser, setActiveUser, setDemoMode } from "../utils/storage";

interface AuthContextValue {
  user: ActiveUser | null;
  /** Role-agnostic login — discovers the role from credentials automatically.
   *  This is the preferred path (no role picker needed). */
  loginAny: (username: string, password: string) => ActiveUser | null;
  login: (role: Role, username: string, password: string) => ActiveUser | null;
  loginDemo: (role: Role) => ActiveUser;
  /** Placeholder Google sign-in. Hook up real OAuth here later. */
  loginGoogle: () => ActiveUser | null;
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
          setDemoMode(false); // a real login is not demo mode
          setActiveUser(nextUser);
          setUser(nextUser);
        }
        return nextUser;
      },
      login: (role, username, password) => {
        const nextUser = authenticate(role, username, password);
        if (nextUser) {
          setDemoMode(false);
          setActiveUser(nextUser);
          setUser(nextUser);
        }

        return nextUser;
      },
      loginDemo: (role) => {
        const nextUser = demoLogin(role);
        setDemoMode(true); // demo = full free-path preview (all worlds)
        setActiveUser(nextUser);
        setUser(nextUser);
        return nextUser;
      },
      loginGoogle: () => {
        /* TODO: integrate real Google OAuth (Google Identity Services).
           For now this is a safe placeholder that signs in as the
           superadmin so the button is fully functional during demos.
           Replace the body with a real token exchange when available. */
        const nextUser = demoLogin("superadmin");
        setDemoMode(false);
        setActiveUser(nextUser);
        setUser(nextUser);
        return nextUser;
      },
      logout: () => {
        setDemoMode(false);
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
