import { DEMO_STUDENT, seedData, SUPERADMIN_USER } from "../data/seed";
import type {
  ActiveUser,
  ClassRoom,
  DemoData,
  EduTicUser,
  Invitation,
  InvitationStatus,
  Role,
  Site,
} from "../types";

/** Strip secrets/derived fields from a stored user record. */
function toActiveUser(user: EduTicUser): ActiveUser {
  const { password: _password, stats: _stats, ...activeUser } = user;
  return activeUser;
}

/** Guarantees the canonical superadmin is always present and correct in a
 *  user list, regardless of what stale data localStorage may hold. Any
 *  existing record matching the superadmin id or username is dropped and
 *  replaced by the seed definition, so credentials can never drift. */
function ensureSuperadmin(users: EduTicUser[]): EduTicUser[] {
  const others = (users ?? []).filter(
    (u) => u.id !== SUPERADMIN_USER.id && u.username !== SUPERADMIN_USER.username,
  );
  return [SUPERADMIN_USER, ...others];
}

export const storageKeys = {
  activeUser: "edutic_active_user",
  demoData: "edutic_demo_data",
  sites: "edutic_sites",
  classes: "edutic_classes",
  users: "edutic_users",
  accessCodes: "edutic_access_codes",
  activities: "edutic_activities",
  assignments: "edutic_assignments",
  attempts: "edutic_attempts",
  rewards: "edutic_rewards",
  invitations: "edutic_invitations",
};

export function ensureSeedData() {
  if (!localStorage.getItem(storageKeys.demoData)) {
    saveDemoData(seedData);
  }
}

export function getDemoData(): DemoData {
  ensureSeedData();

  return {
    sites: read(storageKeys.sites, seedData.sites),
    classes: read(storageKeys.classes, seedData.classes),
    // Self-healing: even if persisted users are missing/stale, the canonical
    // superadmin (admin/admin) is always merged back in.
    users: ensureSuperadmin(read(storageKeys.users, seedData.users)),
    accessCodes: read(storageKeys.accessCodes, seedData.accessCodes),
    activities: read(storageKeys.activities, seedData.activities ?? []),
    assignments: read(storageKeys.assignments, seedData.assignments ?? []),
    attempts: read(storageKeys.attempts, seedData.attempts ?? []),
    rewards: read(storageKeys.rewards, seedData.rewards ?? []),
    invitations: read(storageKeys.invitations, seedData.invitations ?? []),
  };
}

export function saveDemoData(data: DemoData) {
  localStorage.setItem(storageKeys.demoData, "true");
  localStorage.setItem(storageKeys.sites, JSON.stringify(data.sites));
  localStorage.setItem(storageKeys.classes, JSON.stringify(data.classes));
  localStorage.setItem(storageKeys.users, JSON.stringify(data.users));
  localStorage.setItem(storageKeys.accessCodes, JSON.stringify(data.accessCodes));
  localStorage.setItem(storageKeys.activities, JSON.stringify(data.activities ?? []));
  localStorage.setItem(storageKeys.assignments, JSON.stringify(data.assignments ?? []));
  localStorage.setItem(storageKeys.attempts, JSON.stringify(data.attempts ?? []));
  localStorage.setItem(storageKeys.rewards, JSON.stringify(data.rewards ?? []));
  localStorage.setItem(storageKeys.invitations, JSON.stringify(data.invitations ?? []));
}

export function patchDemoData(patch: Partial<DemoData>) {
  saveDemoData({
    ...getDemoData(),
    ...patch,
  });
}

export function getActiveUser(): ActiveUser | null {
  const value = localStorage.getItem(storageKeys.activeUser);
  if (!value) return null;

  try {
    return JSON.parse(value) as ActiveUser;
  } catch {
    return null;
  }
}

export function setActiveUser(user: ActiveUser | null) {
  if (!user) {
    localStorage.removeItem(storageKeys.activeUser);
    return;
  }

  localStorage.setItem(
    storageKeys.activeUser,
    JSON.stringify({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      siteId: user.siteId,
      classId: user.classId,
      active: user.active,
      // Persisted so the forced-password-change guard survives a refresh.
      mustChangePassword: user.mustChangePassword,
    }),
  );
}

export function authenticate(role: Role, username: string, password: string): ActiveUser | null {
  ensureSeedData();
  const users = getDemoData().users;
  const found = users.find(
    (user) => user.role === role && user.username === username && user.password === password,
  );

  if (!found) return null;
  const { password: _password, stats: _stats, ...activeUser } = found;
  return activeUser;
}

/** Canonical email form used everywhere we store or compare emails, so a
 *  Google sign-in always resolves to the same account and no duplicates are
 *  created: trimmed + lowercased. */
export function normalizeEmail(email?: string): string {
  return (email ?? "").trim().toLowerCase();
}

/** Find a real (non-demo) user by email — used to match the address
 *  returned by Google after a successful sign-in. Case-insensitive,
 *  ignores whitespace. Returns `null` if no user has that email. */
export function findUserByEmail(email: string): EduTicUser | null {
  if (!email) return null;
  ensureSeedData();
  const needle = normalizeEmail(email);
  if (!needle) return null;
  const users = getDemoData().users;
  const found = users.find(
    (user) => typeof user.email === "string" && user.email.toLowerCase() === needle,
  );
  return found ?? null;
}

/** Resolves a Typely user from a Google email and returns a sanitised
 *  `ActiveUser` (password/stats stripped). The caller is responsible for
 *  showing a friendly error if this returns null. NEVER auto-promotes an
 *  unknown email to admin or any role — unknown means rejected. */
export function loginByGoogleEmail(email: string): ActiveUser | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  const { password: _password, stats: _stats, ...activeUser } = user;
  return activeUser;
}

/** Role-agnostic login.  In this build ONLY the superadmin (admin/admin)
 *  is a valid login — the sample student records are data-only and never
 *  authenticate.  Role is discovered automatically; no role picker needed. */
export function authenticateAny(username: string, password: string): ActiveUser | null {
  ensureSeedData();
  const trimmedUser = (username ?? "").trim();

  /* Defensive fallback — the seeded superadmin must ALWAYS work, even if
     persisted storage is missing, stale, or corrupted. This is checked
     before touching localStorage so a broken store can never lock admin out. */
  if (
    trimmedUser === SUPERADMIN_USER.username &&
    password === SUPERADMIN_USER.password
  ) {
    return toActiveUser(SUPERADMIN_USER);
  }

  const users = getDemoData().users;
  const found = users.find((user) => {
    if (user.password !== password) return false;
    const byUsername = user.username === trimmedUser;
    const byEmail =
      typeof user.email === "string" &&
      user.email.toLowerCase() === trimmedUser.toLowerCase();
    return byUsername || byEmail;
  });
  if (!found) return null;
  // Students never sign in through the staff form — they use the game via
  // demo mode / their own flow. This keeps the form for staff only.
  if (found.role === "alumno") return null;
  // Deactivated accounts cannot sign in.
  if (found.active === false) return null;
  // The active user carries `mustChangePassword` (set on create/reset), so
  // the route guard can force a password change before any dashboard.
  return toActiveUser(found);
}

/** Demo sign-in. ALWAYS returns the lowest-privilege demo STUDENT, never an
 *  admin/teacher — regardless of any argument. This is a hard security
 *  boundary: demo mode must never grant elevated privileges, so there is no
 *  role parameter and no fallback that could resolve to the superadmin. */
export function demoLogin(): ActiveUser {
  return toActiveUser(DEMO_STUDENT);
}

/* ------------------------------------------------------------------ */
/* Demo-mode flag                                                      */
/* ------------------------------------------------------------------ */
/** Demo mode = full free-path preview (all worlds, no course filter).
 *  Set when entering via the "Entrar en modo demo" button. */
const DEMO_MODE_KEY = "edutic_demo_mode";

export function setDemoMode(on: boolean) {
  if (on) localStorage.setItem(DEMO_MODE_KEY, "true");
  else localStorage.removeItem(DEMO_MODE_KEY);
}

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === "true";
}

export function routeForRole(role: Role) {
  const routes: Record<Role, string> = {
    // Superadmin lands on the GLOBAL administration dashboard — never the
    // student game map (the game is exclusively for students).
    superadmin: "/admin-general",
    "admin-general": "/admin-general",
    "admin-sede": "/admin-sede",
    profesor: "/profesor",
    // Only students enter the gamified world map.
    alumno: "/mundos",
  };

  return routes[role];
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    superadmin: "Superadmin",
    "admin-general": "Admin general",
    "admin-sede": "Admin de sede",
    profesor: "Profesor",
    alumno: "Alumno",
  };

  return labels[role];
}

/* ------------------------------------------------------------------ */
/* Teacher → enabled-worlds-per-class selection                        */
/* ------------------------------------------------------------------ */
/* A class can have a saved set of worldIds the teacher enabled for it.
   Stored as a string[] under `edutic_class_worlds_<classId>`.
   `null` (no key) means "no restriction" → all course worlds enabled. */
function classWorldsKey(classId: string) {
  return `edutic_class_worlds_${classId}`;
}

/** Returns the teacher-enabled worldIds for a class, or null if the
 *  teacher has never customised this class (→ all worlds enabled). */
export function getEnabledWorldsForClass(classId?: string): string[] | null {
  if (!classId) return null;
  const raw = localStorage.getItem(classWorldsKey(classId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : null;
  } catch {
    return null;
  }
}

/** Persists the full set of enabled worldIds for a class. */
export function setEnabledWorldsForClass(classId: string, worldIds: string[]) {
  localStorage.setItem(classWorldsKey(classId), JSON.stringify(worldIds));
}

/** Enables/disables a single world for a class and persists.
 *  `allWorldIds` is used to seed the initial set the first time a teacher
 *  customises (so toggling one world off keeps the rest enabled). */
export function updateTeacherWorldSelection(
  classId: string,
  worldId: string,
  enabled: boolean,
  allWorldIds: string[],
): string[] {
  const current = getEnabledWorldsForClass(classId) ?? allWorldIds;
  const set = new Set(current);
  if (enabled) set.add(worldId);
  else set.delete(worldId);
  const next = allWorldIds.filter((id) => set.has(id)); // keep canonical order
  setEnabledWorldsForClass(classId, next);
  return next;
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createCredentials(name: string) {
  const clean = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 10);

  return {
    username: clean || `user${Date.now().toString().slice(-4)}`,
    password: `${clean || "clave"}${Math.floor(100 + Math.random() * 900)}`,
  };
}

export function getTeacherStudents(activeUser: ActiveUser | null) {
  const data = getDemoData();
  const classRoom = data.classes.find((item) => item.id === activeUser?.classId);
  if (!classRoom) return [];

  return data.users.filter((user) => classRoom.studentIds.includes(user.id));
}

/** All classes a teacher teaches (teacherIds includes them). Falls back to the
 *  single class on their user record if none reference them explicitly. */
export function getClassesForTeacher(activeUser: ActiveUser | null): ClassRoom[] {
  if (!activeUser) return [];
  const data = getDemoData();
  const byTeacher = data.classes.filter((c) => c.teacherIds.includes(activeUser.id));
  if (byTeacher.length) return byTeacher;
  if (activeUser.classId) return data.classes.filter((c) => c.id === activeUser.classId);
  return [];
}

/** Look up a single user by id (used by the per-student detail screen). */
export function getUserById(userId?: string): EduTicUser | undefined {
  if (!userId) return undefined;
  return getDemoData().users.find((u) => u.id === userId);
}

export function addUserToClass(user: EduTicUser, classId?: string) {
  const data = getDemoData();
  const classes: ClassRoom[] = classId
    ? data.classes.map((classRoom) =>
        classRoom.id === classId
          ? {
              ...classRoom,
              studentIds:
                user.role === "alumno"
                  ? Array.from(new Set([...classRoom.studentIds, user.id]))
                  : classRoom.studentIds,
              teacherIds:
                user.role === "profesor"
                  ? Array.from(new Set([...classRoom.teacherIds, user.id]))
                  : classRoom.teacherIds,
            }
          : classRoom,
      )
    : data.classes;

  patchDemoData({
    users: [...data.users, user],
    classes,
  });
}

/* ================================================================== */
/* Ecosystem data functions (sedes, admins, teachers, students,        */
/* classes, invitations). All persist through patchDemoData so the     */
/* superadmin / sede-admin dashboards share one source of truth.       */
/* ================================================================== */

export function getSiteById(siteId?: string): Site | undefined {
  if (!siteId) return undefined;
  return getDemoData().sites.find((site) => site.id === siteId);
}

export function createSite(input: { name: string; city?: string; photo?: string }): Site {
  const data = getDemoData();
  const site: Site = {
    id: makeId("sede"),
    name: input.name.trim() || `Sede ${data.sites.length + 1}`,
    city: input.city?.trim() || "Sin localidad",
    photo: input.photo || undefined,
    active: true,
  };
  patchDemoData({ sites: [...data.sites, site] });
  return site;
}

export function updateSite(siteId: string, patch: Partial<Omit<Site, "id">>): void {
  const data = getDemoData();
  patchDemoData({
    sites: data.sites.map((site) => (site.id === siteId ? { ...site, ...patch } : site)),
  });
}

/** Creates a sede admin (role "admin-sede") bound to a single sede.
 *  Email is required because role lookup (Google sign-in) keys off it. */
export function createSedeAdmin(input: { name: string; email: string; siteId: string }): EduTicUser {
  const data = getDemoData();
  const credentials = createCredentials(input.name);
  const admin: EduTicUser = {
    id: makeId("sede-admin"),
    name: input.name.trim(),
    username: credentials.username,
    // The initial password is temporary — the admin must change it on first
    // sign-in. Normalised email keeps Google sign-in lookups duplicate-free.
    password: credentials.password,
    email: normalizeEmail(input.email),
    role: "admin-sede",
    siteId: input.siteId,
    active: true,
    mustChangePassword: true,
    temporaryPassword: true,
    passwordResetAt: new Date().toISOString(),
  };
  patchDemoData({ users: [...data.users, admin] });
  return admin;
}

/** Edits a sede admin's editable fields (name, email, assigned sede,
 *  active flag). Never touches the password — use `resetUserPassword`. */
export function updateSedeAdmin(
  userId: string,
  patch: { name?: string; email?: string; siteId?: string; active?: boolean },
): void {
  const data = getDemoData();
  patchDemoData({
    users: data.users.map((u) =>
      u.id === userId
        ? {
            ...u,
            ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
            ...(patch.email !== undefined ? { email: normalizeEmail(patch.email) } : {}),
            ...(patch.siteId !== undefined ? { siteId: patch.siteId } : {}),
            ...(patch.active !== undefined ? { active: patch.active } : {}),
          }
        : u,
    ),
  });
}

/** Permanently removes a sede admin. Guarded so it can only ever delete an
 *  `admin-sede` record — never the superadmin or any other role. */
export function deleteSedeAdmin(userId: string): boolean {
  const data = getDemoData();
  const target = data.users.find((u) => u.id === userId);
  if (!target || target.role !== "admin-sede") return false;
  patchDemoData({ users: data.users.filter((u) => u.id !== userId) });
  return true;
}

/** Enables/disables a user account (used for sede admins). */
export function setUserActive(userId: string, active: boolean): void {
  const data = getDemoData();
  patchDemoData({
    users: data.users.map((u) => (u.id === userId ? { ...u, active } : u)),
  });
}

/** Resets a user's password to a freshly generated temporary value and
 *  returns ONLY the new password. The previous password is never read,
 *  returned, or exposed — the superadmin can hand off the temp value once
 *  and then encourage Google sign-in by email. */
export function resetUserPassword(userId: string): string | null {
  const data = getDemoData();
  const target = data.users.find((u) => u.id === userId);
  if (!target) return null;
  const tempPassword = `tmp-${Math.random().toString(36).slice(2, 8)}`;
  patchDemoData({
    users: data.users.map((u) =>
      u.id === userId
        ? {
            ...u,
            password: tempPassword,
            // Force a change on next sign-in with this temporary value.
            mustChangePassword: true,
            temporaryPassword: true,
            passwordResetAt: new Date().toISOString(),
          }
        : u,
    ),
  });
  return tempPassword;
}

/** Sets a user's own chosen password and clears the temporary/force-change
 *  flags. Called from the "Cambiar contraseña" screen after a temp login. */
export function setUserPassword(userId: string, newPassword: string): boolean {
  const data = getDemoData();
  const target = data.users.find((u) => u.id === userId);
  if (!target) return false;
  patchDemoData({
    users: data.users.map((u) =>
      u.id === userId
        ? {
            ...u,
            password: newPassword,
            mustChangePassword: false,
            temporaryPassword: false,
            passwordUpdatedAt: new Date().toISOString(),
          }
        : u,
    ),
  });
  return true;
}

export function createTeacher(input: { name: string; email?: string; siteId?: string; classId?: string }): EduTicUser {
  const credentials = createCredentials(input.name);
  const teacher: EduTicUser = {
    id: makeId("teacher"),
    name: input.name.trim(),
    username: credentials.username,
    password: credentials.password,
    // Normalised so a later Google sign-in with the same address matches.
    email: input.email ? normalizeEmail(input.email) : undefined,
    role: "profesor",
    siteId: input.siteId,
    classId: input.classId,
    // Same forced-change flow as a sede admin: the generated password is
    // temporary and must be changed on first sign-in.
    mustChangePassword: true,
    temporaryPassword: true,
    passwordResetAt: new Date().toISOString(),
  };
  addUserToClass(teacher, input.classId);
  return teacher;
}

export function createStudent(input: { name: string; siteId?: string; classId?: string }): EduTicUser {
  const credentials = createCredentials(input.name);
  const student: EduTicUser = {
    id: makeId("student"),
    name: input.name.trim(),
    username: credentials.username,
    password: credentials.password,
    role: "alumno",
    siteId: input.siteId,
    classId: input.classId,
    stats: { precision: 0, speed: 0, completedLevels: 0, points: 0 },
  };
  addUserToClass(student, input.classId);
  return student;
}

export function createClass(input: { name: string; siteId: string; grade?: ClassRoom["grade"] }): ClassRoom {
  const data = getDemoData();
  const classRoom: ClassRoom = {
    id: makeId("class"),
    name: input.name.trim(),
    siteId: input.siteId,
    grade: input.grade ?? "libre",
    teacherIds: [],
    studentIds: [],
  };
  patchDemoData({ classes: [...data.classes, classRoom] });
  return classRoom;
}

/* ---- Class-scoped getters + student management (sede-admin course view) ---- */

/** Students (role alumno) that belong to a given class. */
export function getStudentsInClass(classId?: string): EduTicUser[] {
  if (!classId) return [];
  const data = getDemoData();
  const classRoom = data.classes.find((c) => c.id === classId);
  if (!classRoom) return [];
  return data.users.filter(
    (u) => u.role === "alumno" && classRoom.studentIds.includes(u.id),
  );
}

/** Teachers (role profesor) assigned to a given class. */
export function getTeachersInClass(classId?: string): EduTicUser[] {
  if (!classId) return [];
  const data = getDemoData();
  const classRoom = data.classes.find((c) => c.id === classId);
  if (!classRoom) return [];
  return data.users.filter(
    (u) => u.role === "profesor" && classRoom.teacherIds.includes(u.id),
  );
}

/** Rename any user (used to edit a student's display name in a course). */
export function updateUserName(userId: string, name: string): void {
  const clean = name.trim();
  if (!clean) return;
  const data = getDemoData();
  patchDemoData({
    users: data.users.map((u) => (u.id === userId ? { ...u, name: clean } : u)),
  });
}

/** Removes a student from a class WITHOUT deleting the account. */
export function removeStudentFromClass(userId: string, classId: string): void {
  const data = getDemoData();
  patchDemoData({
    classes: data.classes.map((c) =>
      c.id === classId
        ? { ...c, studentIds: c.studentIds.filter((id) => id !== userId) }
        : c,
    ),
    users: data.users.map((u) =>
      u.id === userId && u.classId === classId ? { ...u, classId: undefined } : u,
    ),
  });
}

/** Permanently deletes a student account and removes it from every class.
 *  Guarded so it can only ever delete an `alumno` record. */
export function deleteStudent(userId: string): boolean {
  const data = getDemoData();
  const target = data.users.find((u) => u.id === userId);
  if (!target || target.role !== "alumno") return false;
  patchDemoData({
    users: data.users.filter((u) => u.id !== userId),
    classes: data.classes.map((c) => ({
      ...c,
      studentIds: c.studentIds.filter((id) => id !== userId),
    })),
  });
  return true;
}

/* ---- Sede-scoped getters ---- */
export function getUsersBySite(siteId: string | undefined, role?: Role): EduTicUser[] {
  const users = getDemoData().users.filter((u) => u.siteId === siteId);
  return role ? users.filter((u) => u.role === role) : users;
}

export function getClassesBySite(siteId?: string): ClassRoom[] {
  return getDemoData().classes.filter((c) => c.siteId === siteId);
}

export function getInvitationsBySite(siteId?: string): Invitation[] {
  return (getDemoData().invitations ?? []).filter((i) => i.siteId === siteId);
}

/* ---- Counters for the superadmin dashboard ---- */
export interface EcosystemCounts {
  sedes: number;
  sedeAdmins: number;
  teachers: number;
  students: number;
  classes: number;
}

export function getEcosystemCounts(): EcosystemCounts {
  const data = getDemoData();
  return {
    sedes: data.sites.length,
    sedeAdmins: data.users.filter((u) => u.role === "admin-sede").length,
    teachers: data.users.filter((u) => u.role === "profesor").length,
    students: data.users.filter((u) => u.role === "alumno").length,
    classes: data.classes.length,
  };
}

/* ---- Invitations ---- */
function makeToken(): string {
  const rnd = () => Math.random().toString(36).slice(2, 10);
  return `${rnd()}${rnd()}`.toUpperCase();
}

export function createInvitation(input: {
  email: string;
  name?: string;
  role: Role;
  siteId?: string;
  classId?: string;
  invitedBy?: string;
}): Invitation {
  const data = getDemoData();
  const invitation: Invitation = {
    id: makeId("invite"),
    email: input.email.trim(),
    name: input.name?.trim() || undefined,
    role: input.role,
    siteId: input.siteId,
    classId: input.classId,
    token: makeToken(),
    status: "pending",
    createdAt: new Date().toISOString(),
    invitedBy: input.invitedBy,
  };
  patchDemoData({ invitations: [invitation, ...(data.invitations ?? [])] });
  return invitation;
}

export function setInvitationStatus(id: string, status: InvitationStatus): void {
  const data = getDemoData();
  const now = new Date().toISOString();
  patchDemoData({
    invitations: (data.invitations ?? []).map((inv) =>
      inv.id === id
        ? {
            ...inv,
            status,
            sentAt: status === "sent" ? now : inv.sentAt,
            acceptedAt: status === "accepted" ? now : inv.acceptedAt,
          }
        : inv,
    ),
  });
}

export function getInvitationByToken(token: string): Invitation | undefined {
  return (getDemoData().invitations ?? []).find((inv) => inv.token === token);
}

/** Builds a shareable invitation link from a token. Safe for the browser —
 *  contains no secret, just an opaque token. */
export function buildInvitationLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

function read<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
