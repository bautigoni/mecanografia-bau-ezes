/* Thin API client used by the React app to talk to the Fastify service.
 *
 * Design notes:
 *  - All authenticated calls send `Authorization: Bearer <access>` from
 *    the in-memory access token. On 401 we try one silent refresh against
 *    `/api/auth/refresh` (HTTP-only cookie) and retry the original call.
 *  - `apiBaseUrl()` defaults to `/api` so it works behind Caddy without
 *    configuration. An explicit `VITE_API_URL` override is supported for
 *    local dev against a different origin.
 *  - Errors are thrown as `ApiError` with a friendly Spanish message —
 *    the UI never has to guess.
 *  - The frontend is NOT the source of truth for users. This client
 *    calls the API and falls back to localStorage only when the API is
 *    unreachable (so the demo mode keeps working offline). */

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

let accessToken: string | null = null;
const refreshListeners: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
  for (const l of refreshListeners) l(token);
}
export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOpts extends RequestInit {
  json?: unknown;
  retry?: boolean;
}

async function call<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { json, retry = true, headers, ...rest } = opts;
  const finalHeaders = new Headers(headers);
  if (json !== undefined) finalHeaders.set("content-type", "application/json");
  if (accessToken) finalHeaders.set("authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: json !== undefined ? JSON.stringify(json) : (rest as RequestInit).body,
    credentials: "include", // send refresh cookie
  });

  if (res.status === 401 && retry && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/google") {
    // Try a silent refresh once.
    const refreshed = await refresh();
    if (refreshed) return call<T>(path, { ...opts, retry: false });
  }

  if (!res.ok) {
    let message = "Error desconocido.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function refresh(): Promise<boolean> {
  try {
    const res = await call<{ access: string }>("/auth/refresh", { method: "POST", retry: false });
    setAccessToken(res.access);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Auth endpoints                                                      */
/* ------------------------------------------------------------------ */
export interface ApiActiveUser {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: "superadmin" | "admin-general" | "admin-sede" | "profesor" | "alumno";
  sedeId?: string | null;
  classId?: string | null;
  mustChangePassword?: boolean;
}

export interface ApiSede {
  id: string;
  name: string;
  city: string;
  photo?: string | null;
  active?: boolean;
}

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  username?: string | null;
  role: "superadmin" | "admin-general" | "admin-sede" | "profesor" | "alumno";
  sedeId?: string | null;
  classId?: string | null;
  grade?: string | null;
  active?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
}

export interface ApiClass {
  id: string;
  name: string;
  grade: string;
  sedeId: string;
  studentCount: number;
  teacherCount: number;
}

export interface ClassMember {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  lastLoginAt: string | null;
}

export const api = {
  async login(emailOrUsername: string, password: string): Promise<{ user: ApiActiveUser; access: string }> {
    const res = await call<{ user: ApiActiveUser; access: string }>("/auth/login", {
      method: "POST",
      json: { [emailOrUsername.includes("@") ? "email" : "username"]: emailOrUsername, password },
    });
    setAccessToken(res.access);
    return res;
  },
  async google(credential: string): Promise<{ user: ApiActiveUser; access: string }> {
    const res = await call<{ user: ApiActiveUser; access: string }>("/auth/google", {
      method: "POST",
      json: { credential },
    });
    setAccessToken(res.access);
    return res;
  },
  async logout(): Promise<void> {
    try {
      await call("/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
    }
  },
  async me(): Promise<{ user: ApiActiveUser } | null> {
    try {
      return await call("/auth/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  /* Called once at app boot to recover a session from the refresh cookie. */
  async bootstrap(): Promise<ApiActiveUser | null> {
    try {
      const refreshed = await refresh();
      if (!refreshed) return null;
      const me = await api.me();
      return me?.user ?? null;
    } catch {
      return null;
    }
  },
  /* ---- Sedes ---- */
  listSedes: () => call<ApiSede[]>("/sedes"),
  mySede: () => call<ApiSede>("/sedes/mine"),
  createSede: (payload: { name: string; city?: string; photo?: string }) =>
    call<ApiSede>("/sedes", { method: "POST", json: payload }),
  updateSede: (id: string, payload: Partial<{ name: string; city: string; photo?: string; active: boolean }>) =>
    call<ApiSede>(`/sedes/${id}`, { method: "PATCH", json: payload }),
  deleteSede: (id: string) => call<{ ok: true }>(`/sedes/${id}`, { method: "DELETE" }),

  /* ---- Users ---- */
  listUsers: (q: { role?: string; sedeId?: string } = {}) => {
    const params = new URLSearchParams();
    if (q.role) params.set("role", q.role);
    if (q.sedeId) params.set("sedeId", q.sedeId);
    const qs = params.toString();
    return call<ApiUser[]>(`/users${qs ? `?${qs}` : ""}`);
  },
  createUser: (payload: {
    fullName: string;
    email: string;
    role: "admin-sede" | "profesor" | "alumno" | "admin-general" | "superadmin";
    username?: string;
    password?: string;
    sedeId?: string | null;
    classId?: string | null;
  }) =>
    call<{ user: { id: string; email: string; name: string; username?: string; role: string; sedeId?: string | null; classId?: string | null }; temporaryPassword: string | null }>(
      "/users",
      { method: "POST", json: payload },
    ),
  updateUser: (id: string, payload: Partial<{ fullName: string; email: string; sedeId: string | null; classId: string | null; active: boolean }>) =>
    call<ApiUser>(`/users/${id}`, { method: "PATCH", json: payload }),
  deleteUser: (id: string) => call<{ ok: true }>(`/users/${id}`, { method: "DELETE" }),
  resetUserPassword: (id: string) => call<{ temporaryPassword: string }>(`/users/${id}/reset-password`, { method: "POST" }),

  /* ---- Classes (cursos) ---- */
  listClasses: (sedeId?: string) => call<ApiClass[]>(`/classes${sedeId ? `?sedeId=${sedeId}` : ""}`),
  createClass: (payload: { name: string; sedeId?: string; grade?: string }) =>
    call<ApiClass>("/classes", { method: "POST", json: payload }),
  deleteClass: (id: string) => call<{ ok: true }>(`/classes/${id}`, { method: "DELETE" }),
  updateClass: (id: string, payload: { name?: string; grade?: string }) =>
    call<ApiClass>(`/classes/${id}`, { method: "PATCH", json: payload }),
  classMembers: (id: string) =>
    call<{ class: { id: string; name: string; grade: string; sedeId: string }; teachers: ClassMember[]; students: ClassMember[] }>(`/classes/${id}/members`),
  assignTeacher: (classId: string, userId: string) =>
    call<{ ok: true }>(`/classes/${classId}/teachers`, { method: "POST", json: { userId } }),
  unassignTeacher: (classId: string, userId: string) =>
    call<{ ok: true }>(`/classes/${classId}/teachers/${userId}`, { method: "DELETE" }),
  getClassWorlds: (id: string) => call<{ worldIds: string[] | null }>(`/classes/${id}/worlds`),
  setClassWorlds: (id: string, worldIds: string[]) =>
    call<{ ok: true }>(`/classes/${id}/worlds`, { method: "PUT", json: { worldIds } }),
  /* Progress. */
  postProgressComplete: (payload: {
    worldId: string;
    levelNumber: number;
    accuracy: number;
    wpm?: number;
    errorCount: number;
    startedAt: string;
    endedAt: string;
  }) => call("/progress/complete", { method: "POST", json: payload }),

  /* Invitations — create (+ email via Resend), list, public lookup, accept. */
  createInvitation: (payload: { email: string; name?: string; role?: "admin-sede" | "profesor"; sedeId?: string; classId?: string }) =>
    call<{ invitation: { id: string; email: string; name?: string | null; role: string; status: string; createdAt: string }; emailed: boolean; link: string }>(
      "/invitations",
      { method: "POST", json: payload },
    ),
  listInvitations: () =>
    call<Array<{ id: string; email: string; name?: string | null; role: string; status: string; sedeId?: string | null; createdAt: string }>>("/invitations"),
  getInvitation: (token: string) =>
    call<{ invitation: { email: string; name?: string | null; role: string; status: string; sedeName?: string } }>(
      `/invitations/by-token/${encodeURIComponent(token)}`,
    ),
  acceptInvitation: async (token: string, password: string): Promise<{ user: ApiActiveUser; access: string }> => {
    const res = await call<{ user: ApiActiveUser; access: string }>(`/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      json: { password },
      retry: false,
    });
    setAccessToken(res.access);
    return res;
  },

  /* Bulk CSV import. Sends raw CSV; the API parses + creates accounts. */
  importUsersCsv: (csv: string) => call<{
    created: number;
    skipped: number;
    results: Array<{ row: number | false; ok: boolean; email: string; username?: string; temporaryPassword?: string; message?: string }>;
    errors: Array<{ row: number; message: string }>;
  }>("/import/users", { method: "POST", body: csv, headers: { "content-type": "text/csv" } }),
};
