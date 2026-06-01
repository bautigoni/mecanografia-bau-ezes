import { createContext, useContext, useMemo, useState } from "react";
import type { ActiveUser, Role } from "../types";
import {
  authenticate,
  authenticateAny,
  demoLogin,
  ensureSeedData,
  getActiveUser,
  loginByGoogleEmail,
  setActiveUser,
  setDemoMode,
} from "../utils/storage";
import { isEmailDomainAllowed, parseJwtCredential } from "../utils/googleAuth";

/** Result of a Google sign-in attempt. Always returns a structured value
 *  so the UI can render a friendly Spanish message — `null` would lose
 *  the reason. */
export type GoogleLoginResult =
  | { ok: true; user: ActiveUser }
  | { ok: false; reason: "INVALID_TOKEN" | "DOMAIN_NOT_ALLOWED" | "USER_NOT_FOUND" };

interface AuthContextValue {
  user: ActiveUser | null;
  /** Role-agnostic login — discovers the role from credentials automatically.
   *  This is the preferred path (no role picker needed). */
  loginAny: (username: string, password: string) => ActiveUser | null;
  login: (role: Role, username: string, password: string) => ActiveUser | null;
  loginDemo: (role: Role) => ActiveUser;
  /** Sign in with a Google Identity Services ID-token credential.
   *  - Decodes the token (client-side, untrusted) to read the email.
   *  - Rejects unknown emails — never auto-creates admin accounts.
   *  - Optionally enforces the institutional domain allowlist. */
  loginGoogle: (credential: string) => GoogleLoginResult;
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
      loginGoogle: (credential) => {
        /* The credential is the ID-token JWT returned by GIS. We decode
           it on the client only to read the email + display fields. The
           authorisation decision (which Typely user this maps to, and
           which role they get) comes from our own user store — never
           from the JWT claims. */
        const payload = parseJwtCredential(credential);
        if (!payload || !payload.email) {
          return { ok: false, reason: "INVALID_TOKEN" };
        }
        if (!isEmailDomainAllowed(payload.email)) {
          return { ok: false, reason: "DOMAIN_NOT_ALLOWED" };
        }
        const nextUser = loginByGoogleEmail(payload.email);
        if (!nextUser) {
          return { ok: false, reason: "USER_NOT_FOUND" };
        }
        setDemoMode(false);
        setActiveUser(nextUser);
        setUser(nextUser);
        return { ok: true, user: nextUser };
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
