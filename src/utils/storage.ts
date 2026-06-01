import { demoUsers, seedData } from "../data/seed";
import type { ActiveUser, ClassRoom, DemoData, EduTicUser, Role } from "../types";

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
    users: read(storageKeys.users, seedData.users),
    accessCodes: read(storageKeys.accessCodes, seedData.accessCodes),
    activities: read(storageKeys.activities, seedData.activities ?? []),
    assignments: read(storageKeys.assignments, seedData.assignments ?? []),
    attempts: read(storageKeys.attempts, seedData.attempts ?? []),
    rewards: read(storageKeys.rewards, seedData.rewards ?? []),
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
      role: user.role,
      siteId: user.siteId,
      classId: user.classId,
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

/** Role-agnostic login.  In this build ONLY the superadmin (admin/admin)
 *  is a valid login — the sample student records are data-only and never
 *  authenticate.  Role is discovered automatically; no role picker needed. */
export function authenticateAny(username: string, password: string): ActiveUser | null {
  ensureSeedData();
  const users = getDemoData().users;
  const found = users.find(
    (user) => user.username === username && user.password === password,
  );
  if (!found) return null;
  // Hard rule: only the superadmin account may sign in via the UI.
  if (found.role !== "superadmin") return null;
  const { password: _password, stats: _stats, ...activeUser } = found;
  return activeUser;
}

export function demoLogin(role: Role): ActiveUser {
  const user = demoUsers.find((candidate) => candidate.role === role) ?? demoUsers[0];
  if (!user) {
    throw new Error(`No demo user configured for role ${role}`);
  }

  const { password: _password, stats: _stats, ...activeUser } = user;
  return activeUser;
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
    // Superadmin lands on the world map (full free-path access). They can
    // reach the teacher/admin views from there.
    superadmin: "/mundos",
    "admin-general": "/admin-general",
    "admin-sede": "/admin-sede",
    profesor: "/profesor",
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

function read<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
