import type { DemoData, DemoUser } from "../types";

/* The ONLY login account in this build.
   Superadmin has full access to everything: all worlds, all islands,
   all levels, teacher/admin views and the free path.
   Login:  username "admin"  /  password "admin". */
export const SUPERADMIN_USER: DemoUser = {
  id: "u-superadmin",
  name: "Super Admin",
  username: "admin",
  /* Real email used to match a Google sign-in. The actual production
     superadmin email is configured per-deployment; this seed value is
     only meaningful during local demos. */
  email: "gonibauti@gmail.com",
  password: "admin",
  role: "superadmin",
  siteId: "sede-norte",
  classId: "clase-3a",
};

export const demoUsers: DemoUser[] = [SUPERADMIN_USER];

/* Sample student records — kept ONLY as data for the teacher view
   (names / progress columns).  They are NOT valid login accounts:
   `authenticateAny` only authenticates the superadmin. */
const sampleStudents: DemoUser[] = [
  {
    id: "u-sofia",
    name: "Sofia",
    username: "sofia",
    password: "—",
    role: "alumno",
    siteId: "sede-norte",
    classId: "clase-3a",
    stats: { precision: 94, speed: 18, completedLevels: 1, points: 1280 },
  },
  {
    id: "u-lucas",
    name: "Lucas",
    username: "lucas",
    password: "—",
    role: "alumno",
    siteId: "sede-norte",
    classId: "clase-3a",
    stats: { precision: 87, speed: 14, completedLevels: 1, points: 930 },
  },
  {
    id: "u-valen",
    name: "Valentina",
    username: "valen",
    password: "—",
    role: "alumno",
    siteId: "sede-norte",
    classId: "clase-3a",
    stats: { precision: 91, speed: 16, completedLevels: 2, points: 1140 },
  },
];

export const seedData: DemoData = {
  sites: [
    {
      id: "sede-norte",
      name: "Sede Norte",
      city: "Buenos Aires",
      coordinator: "Coordinacion TIC",
    },
    {
      id: "sede-sur",
      name: "Sede Sur",
      city: "La Plata",
      coordinator: "Equipo Digital",
    },
  ],
  classes: [
    {
      id: "clase-3a",
      name: "3ro A - Turno manana",
      siteId: "sede-norte",
      grade: "3ep" as const,
      teacherIds: ["u-superadmin"],
      studentIds: ["u-sofia", "u-lucas", "u-valen"],
    },
  ],
  users: [...demoUsers, ...sampleStudents],
  accessCodes: [
    {
      id: "code-admin-sede",
      role: "Admin de sede",
      site: "Sede Norte",
      code: "SEDE-NORTE-42",
      status: "Activo",
    },
    {
      id: "code-profesor",
      role: "Profesor",
      site: "Sede Norte",
      code: "PROFE-3A-18",
      status: "Activo",
    },
    {
      id: "code-alumno",
      role: "Alumno",
      site: "Sede Norte",
      code: "ALUMNO-3A-77",
      status: "Activo",
    },
  ],
  activities: [
    { id: "encuentro-letras", title: "Encuentro letras", route: "/gameplay/encuentro-letras", level: 1 },
    { id: "letra-rapida", title: "Letra rápida", route: "/gameplay/letra-rapida", level: 2 },
  ],
  assignments: [],
  attempts: [],
  rewards: [
    { id: "reward-sofia-1", userId: "u-sofia", name: "Medalla inicial", unlocked: true },
    { id: "reward-sofia-2", userId: "u-sofia", name: "Llave de teclas", unlocked: true },
  ],
};
