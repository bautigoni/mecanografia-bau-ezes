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
      // Fastify's default 4xx body is { statusCode, error, message }. Our
      // custom setErrorHandler usually sends a friendlier Spanish body of
      // just { error: "..." }. We try `message` first (the localized one),
      // then fall back to `error`.
      const data = (await res.json()) as { error?: string; message?: string };
      message = data?.message || data?.error || message;
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
  academicYearId?: string | null;
  status?: "active" | "archived";
}

export interface ClassMember {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  lastLoginAt: string | null;
}

export interface AdminOverview {
  counts: { courses: number; teachers: number; students: number };
  activeToday: number;
  avgProgress: number;
  weekly: { date: string; label: string; count: number }[];
  alerts: { inactiveStudents: number; lowPrecisionStudents: number; inactiveTeachers: number; coursesNoTeacher: number };
  attentionCourses: { id: string; name: string; reason: string }[];
  recent: { studentName: string; worldId: string; completed: boolean; at: string }[];
}

export interface StudentDetail {
  student: { id: string; fullName: string; username: string | null; email: string; classId: string | null; className: string | null };
  stats: { completedLevels: number; avgAccuracy: number; currentWorld: string | null; currentLevel: number; totalSeconds: number; streakDays: number; totalAttempts: number; xp: number; stars: number };
  byWorld: { worldId: string; completed: number; avgAccuracy: number }[];
  achievements: { id: string; unlockedAt: string }[];
  timeline: { worldId: string; levelNumber: number; accuracy: number; completed: boolean; errorCount: number; at: string }[];
}

export interface TeacherDetail {
  teacher: { id: string; fullName: string; username: string | null; email: string; lastLoginAt: string | null };
  classes: { id: string; name: string; grade: string; studentCount: number }[];
  stats: { classCount: number; studentCount: number };
  recent: { studentName: string; worldId: string; completed: boolean; at: string }[];
}

export interface ClassProgressRow {
  id: string;
  fullName: string;
  username: string | null;
  lastActivity: string | null;
  completedLevels: number;
  avgAccuracy: number;
  currentWorld: string | null;
  byWorld: Record<string, { completed: number; avgAccuracy: number }>;
}

export interface AcademicYear {
  id: string;
  sedeId: string;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  closedAt: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: string | null;
  at: string;
  actorId: string | null;
  actorName: string | null;
}

export interface ApiInspectorReport {
  service: { name: string; version: string; node: string; env: string; startedAt: string; uptimeSeconds: number };
  db: { ok: boolean; latencyMs: number | null; error: string | null };
  env: Array<{ name: string; scope: "server" | "client"; public: boolean; set: boolean; value: string | null; note: string }>;
  config: {
    accessTokenTtlMinutes: number;
    refreshTokenTtlDays: number;
    invitationTtlDays: number;
    bodyLimitBytes: number;
    bcryptCost: number;
    corsOrigin: string;
    googleLoginEnabled: boolean;
    inviteEmailsEnabled: boolean;
  };
  routes: Array<{ method: string; url: string; sample: unknown }>;
  recentErrors: Array<{ at: string; status: number; method: string; url: string; message: string }>;
  recentAudit: Array<{ action: string; entityType: string; entityId: string | null; at: string; actorName: string | null }>;
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
  listUsers: (q: { role?: string; sedeId?: string; includeDeleted?: "1" } = {}) => {
    const params = new URLSearchParams();
    if (q.role) params.set("role", q.role);
    if (q.sedeId) params.set("sedeId", q.sedeId);
    if (q.includeDeleted) params.set("includeDeleted", q.includeDeleted);
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
  updateUser: (id: string, payload: Partial<{ fullName: string; email: string; username: string; sedeId: string | null; classId: string | null; active: boolean }>) =>
    call<ApiUser>(`/users/${id}`, { method: "PATCH", json: payload }),
  deleteUser: (id: string) => call<{ ok: true }>(`/users/${id}`, { method: "DELETE" }),
  restoreUser: (id: string) => call<{ ok: true }>(`/users/${id}/restore`, { method: "POST" }),
  resetUserPassword: (id: string) => call<{ temporaryPassword: string }>(`/users/${id}/reset-password`, { method: "POST" }),
  /* Self-service: set the signed-in user's own password (clears the
     mustChangePassword flag server-side). */
  changeOwnPassword: (id: string, newPassword: string) =>
    call<{ ok: true }>(`/users/${id}/change-password`, { method: "POST", json: { newPassword } }),

  /* ---- Classes (cursos) ---- */
  listClasses: (sedeId?: string, includeArchived = false) =>
    call<ApiClass[]>(`/classes${sedeId || includeArchived ? `?${[sedeId ? `sedeId=${sedeId}` : "", includeArchived ? "includeArchived=1" : ""].filter(Boolean).join("&")}` : ""}`),
  createClass: (payload: { name: string; sedeId?: string; grade?: string }) =>
    call<ApiClass>("/classes", { method: "POST", json: payload }),
  deleteClass: (id: string) => call<{ ok: true }>(`/classes/${id}`, { method: "DELETE" }),
  updateClass: (id: string, payload: { name?: string; grade?: string }) =>
    call<ApiClass>(`/classes/${id}`, { method: "PATCH", json: payload }),
  archiveClass: (id: string) => call<{ ok: true; alreadyArchived?: boolean }>(`/classes/${id}/archive`, { method: "POST" }),
  reactivateClass: (id: string) => call<{ ok: true }>(`/classes/${id}/reactivate`, { method: "POST" }),
  classMembers: (id: string) =>
    call<{ class: { id: string; name: string; grade: string; sedeId: string }; teachers: ClassMember[]; students: ClassMember[] }>(`/classes/${id}/members`),
  assignTeacher: (classId: string, userId: string) =>
    call<{ ok: true }>(`/classes/${classId}/teachers`, { method: "POST", json: { userId } }),
  unassignTeacher: (classId: string, userId: string) =>
    call<{ ok: true }>(`/classes/${classId}/teachers/${userId}`, { method: "DELETE" }),
  getClassWorlds: (id: string) => call<{ worldIds: string[] | null }>(`/classes/${id}/worlds`),
  setClassWorlds: (id: string, worldIds: string[]) =>
    call<{ ok: true }>(`/classes/${id}/worlds`, { method: "PUT", json: { worldIds } }),
  assignStudent: (classId: string, userId: string) =>
    call<{ ok: true }>(`/classes/${classId}/students`, { method: "POST", json: { userId } }),
  classProgress: (id: string) => call<{ students: ClassProgressRow[] }>(`/classes/${id}/progress`),
  adminOverview: (sedeId?: string) => call<AdminOverview>(`/admin/overview${sedeId ? `?sedeId=${sedeId}` : ""}`),
  studentDetail: (id: string) => call<StudentDetail>(`/students/${id}`),
  teacherDetail: (id: string) => call<TeacherDetail>(`/teachers/${id}`),

  /* Academic years (F6). */
  listAcademicYears: (sedeId?: string) => call<AcademicYear[]>(`/academic-years${sedeId ? `?sedeId=${sedeId}` : ""}`),
  createAcademicYear: (payload: { label: string; startsAt?: string; endsAt?: string; sedeId?: string }) =>
    call<AcademicYear>("/academic-years", { method: "POST", json: payload }),
  activateAcademicYear: (id: string) => call<{ ok: true }>(`/academic-years/${id}/activate`, { method: "PATCH" }),
  closePreview: (id: string) => call<{
    year: { id: string; label: string; courseCount: number; studentCount: number };
    target: { id: string; label: string } | null;
    byGrade: Record<string, number>;
  }>(`/academic-years/${id}/close-preview`),
  closeAcademicYear: (id: string, payload: { targetYearId?: string; promotion?: Record<string, string> } = {}) =>
    call<{ ok: true; closedCourses: number; promoted: number; graduated: number; targetYear: { id: string; label: string } | null }>(
      `/academic-years/${id}/close`,
      { method: "POST", json: payload },
    ),

  /* Inspector de API (F7) — superadmin / admin-general / admin-sede. */
  inspector: () => call<ApiInspectorReport>("/admin/inspector"),

  /* Audit log (F6). */
  listAudit: (params: { sedeId?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.sedeId) qs.set("sedeId", params.sedeId);
    if (params.limit) qs.set("limit", String(params.limit));
    const s = qs.toString();
    return call<AuditEntry[]>(`/audit${s ? `?${s}` : ""}`);
  },
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
  expireInvitation: (id: string) => call<{ ok: true }>(`/invitations/${id}`, { method: "DELETE" }),
  expireAllInvitations: () => call<{ expired: number }>("/invitations/expire-all", { method: "POST" }),
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
