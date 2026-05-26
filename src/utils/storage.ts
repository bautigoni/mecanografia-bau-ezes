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

export function demoLogin(role: Role): ActiveUser {
  const user = demoUsers.find((candidate) => candidate.role === role);
  if (!user) {
    throw new Error(`No demo user configured for role ${role}`);
  }

  const { password: _password, stats: _stats, ...activeUser } = user;
  return activeUser;
}

export function routeForRole(role: Role) {
  const routes: Record<Role, string> = {
    "admin-general": "/admin-general",
    "admin-sede": "/admin-sede",
    profesor: "/profesor",
    alumno: "/mundos",
  };

  return routes[role];
}

export function roleLabel(role: Role) {
  const labels: Record<Role, string> = {
    "admin-general": "Admin general",
    "admin-sede": "Admin de sede",
    profesor: "Profesor",
    alumno: "Alumno",
  };

  return labels[role];
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
