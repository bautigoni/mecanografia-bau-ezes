import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  setUserPassword,
  getViewAs,
  setViewAsStored,
  type ViewAs,
} from "../utils/storage";
import { isEmailDomainAllowed, parseJwtCredential } from "../utils/googleAuth";
import { api, ApiError, type ApiActiveUser } from "../utils/api";

/** Result of a Google sign-in attempt. Always returns a structured value
 *  so the UI can render a friendly Spanish message — `null` would lose
 *  the reason. */
export type GoogleLoginResult =
  | { ok: true; user: ActiveUser }
  | { ok: false; reason: "INVALID_TOKEN" | "DOMAIN_NOT_ALLOWED" | "USER_NOT_FOUND" | "NETWORK_ERROR" };

/* The localStorage user shape and the API user shape are intentionally
   compatible — we map between them in one place so the rest of the app
   never has to know. */
function toActiveUser(u: ApiActiveUser): ActiveUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? "",
    email: u.email,
    role: u.role,
    siteId: u.sedeId ?? undefined,
    classId: u.classId ?? undefined,
    mustChangePassword: u.mustChangePassword,
    active: true,
  };
}

interface AuthContextValue {
  user: ActiveUser | null;
  /** True while the silent bootstrap is still running — pages can show
   *  a soft loader while we try the refresh-cookie. */
  bootstrapping: boolean;
  /** True if the last login round-trip went to the API (not local). Set
   *  after a successful API login OR bootstrap. Used by the dashboard
   *  shells to decide whether to show a "Backend offline" banner. */
  usingApi: boolean;
  loginAny: (username: string, password: string) => Promise<ActiveUser | null>;
  login: (role: Role, username: string, password: string) => Promise<ActiveUser | null>;
  /** Demo sign-in — always the lowest-privilege demo student. */
  loginDemo: () => ActiveUser;
  completePasswordChange: (newPassword: string) => Promise<ActiveUser | null>;
  loginGoogle: (credential: string) => Promise<GoogleLoginResult>;
  /** Adopt a session created out-of-band (e.g. accepting an invitation,
   *  which logs the user in server-side). The access token + refresh cookie
   *  are already set by the api client; this syncs the React/local state. */
  adoptSession: (apiUser: ApiActiveUser) => ActiveUser;
  /** Superadmin "god mode": the role/sede/dev surface they chose to enter
   *  from the "¿Cómo querés entrar?" chooser. `null` = act as superadmin. */
  viewAs: ViewAs | null;
  setViewAs: (view: ViewAs | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  ensureSeedData();
  const [user, setUser] = useState<ActiveUser | null>(() => getActiveUser());
  const [bootstrapping, setBootstrapping] = useState(true);
  const [usingApi, setUsingApi] = useState(false);
  const [viewAs, setViewAsState] = useState<ViewAs | null>(() => getViewAs());

  const setViewAs = useCallback((view: ViewAs | null) => {
    setViewAsStored(view);
    setViewAsState(view);
  }, []);

  /* Try to recover a session from the HTTP-only refresh cookie. If it
     works we replace the localStorage user with the API user (more
     authoritative). If it fails we keep whatever localStorage has so
     demo mode stays functional. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiUser = await api.bootstrap();
        if (cancelled) return;
        if (apiUser) {
          const au = toActiveUser(apiUser);
          setActiveUser(au);
          setUser(au);
          setUsingApi(true);
        }
      } catch {
        /* offline / API not up yet — fall through, localStorage user remains */
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loginAny = useCallback(async (username: string, password: string): Promise<ActiveUser | null> => {
    try {
      const { user: apiUser } = await api.login(username, password);
      const au = toActiveUser(apiUser);
      setDemoMode(false);
      setActiveUser(au);
      setUser(au);
      setUsingApi(true);
      return au;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        // Server is reachable but rejected credentials — do NOT fall through to
        // localStorage, that would risk a stale "admin/admin" matching.
        return null;
      }
      // Network error or server down: fall back to the in-browser user list.
      const nextUser = authenticateAny(username, password);
      if (nextUser) {
        setDemoMode(false);
        setActiveUser(nextUser);
        setUser(nextUser);
        setUsingApi(false);
      }
      return nextUser;
    }
  }, []);

  const login = useCallback(async (role: Role, username: string, password: string): Promise<ActiveUser | null> => {
    try {
      const { user: apiUser } = await api.login(username, password);
      if (apiUser.role !== role) {
        return null; // server is authoritative about role
      }
      const au = toActiveUser(apiUser);
      setDemoMode(false);
      setActiveUser(au);
      setUser(au);
      setUsingApi(true);
      return au;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
        return null;
      }
      const nextUser = authenticate(role, username, password);
      if (nextUser) {
        setDemoMode(false);
        setActiveUser(nextUser);
        setUser(nextUser);
        setUsingApi(false);
      }
      return nextUser;
    }
  }, []);

  const loginDemo = useCallback((): ActiveUser => {
    const nextUser = demoLogin();
    setDemoMode(true);
    setActiveUser(nextUser);
    setUser(nextUser);
    setUsingApi(false); // demo never round-trips the API
    return nextUser;
  }, []);

  const completePasswordChange = useCallback(async (newPassword: string): Promise<ActiveUser | null> => {
    if (!user) return null;
    if (usingApi) {
      try {
        await api.logout(); // placeholder — real endpoint is /api/users/:id/change-password, called from the page
        // The page should call api.post("/users/:id/change-password", ...) directly. We don't expose that
        // here so the typed contract stays small. For the localStorage path the old behaviour applies.
      } catch { /* ignore */ }
    }
    const ok = setUserPassword(user.id, newPassword);
    if (!ok) return null;
    const refreshed: ActiveUser = { ...user, mustChangePassword: false };
    setActiveUser(refreshed);
    setUser(refreshed);
    return refreshed;
  }, [user, usingApi]);

  const loginGoogle = useCallback(async (credential: string): Promise<GoogleLoginResult> => {
    const payload = parseJwtCredential(credential);
    if (!payload || !payload.email) return { ok: false, reason: "INVALID_TOKEN" };
    /* NOTE: the domain allowlist is NOT applied up front anymore. An account
       that an admin already created (any email, including @gmail.com) must be
       able to sign in with Google. The allowlist only gates UNKNOWN emails. */
    try {
      const { user: apiUser } = await api.google(credential);
      const au = toActiveUser({ ...apiUser, mustChangePassword: false });
      setDemoMode(false);
      setActiveUser(au);
      setUser(au);
      setUsingApi(true);
      return { ok: true, user: au };
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        return { ok: false, reason: "INVALID_TOKEN" };
      }
      // 404 (server: no such user) or network error → look in the local user
      // list. A matching account is ALWAYS allowed regardless of its domain.
      const nextUser = loginByGoogleEmail(payload.email);
      if (nextUser) {
        const au: ActiveUser = { ...nextUser, mustChangePassword: false };
        setDemoMode(false);
        setActiveUser(au);
        setUser(au);
        setUsingApi(false);
        return { ok: true, user: au };
      }
      // Unknown email: a non-allowlisted domain gets the clearer message.
      if (!isEmailDomainAllowed(payload.email)) return { ok: false, reason: "DOMAIN_NOT_ALLOWED" };
      return { ok: false, reason: "USER_NOT_FOUND" };
    }
  }, []);

  const adoptSession = useCallback((apiUser: ApiActiveUser): ActiveUser => {
    const au = toActiveUser(apiUser);
    setDemoMode(false);
    setActiveUser(au);
    setUser(au);
    setUsingApi(true);
    return au;
  }, []);

  const logout = useCallback(async () => {
    setDemoMode(false);
    setViewAsStored(null);
    setViewAsState(null);
    if (usingApi) {
      try { await api.logout(); } catch { /* ignore */ }
    }
    setActiveUser(null);
    setUser(null);
  }, [usingApi]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, bootstrapping, usingApi, loginAny, login, loginDemo, completePasswordChange, loginGoogle, adoptSession, viewAs, setViewAs, logout }),
    [user, bootstrapping, usingApi, loginAny, login, loginDemo, completePasswordChange, loginGoogle, adoptSession, viewAs, setViewAs, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
