import type { DemoData, DemoUser } from "../types";

export const demoUsers: DemoUser[] = [
  {
    id: "u-admin-general",
    name: "Admin General",
    username: "admin",
    password: "admin123",
    role: "admin-general",
  },
  {
    id: "u-admin-sede",
    name: "Coordinacion TIC",
    username: "sede",
    password: "sede123",
    role: "admin-sede",
    siteId: "sede-norte",
  },
  {
    id: "u-profesor",
    name: "Profe Martin",
    username: "profe",
    password: "profe123",
    role: "profesor",
    siteId: "sede-norte",
    classId: "clase-3a",
  },
  {
    id: "u-sofia",
    name: "Sofia",
    username: "sofia",
    password: "alumno123",
    role: "alumno",
    siteId: "sede-norte",
    classId: "clase-3a",
    stats: {
      precision: 94,
      speed: 18,
      completedLevels: 1,
      points: 1280,
    },
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
      teacherIds: ["u-profesor"],
      studentIds: ["u-sofia", "u-lucas", "u-valen"],
    },
  ],
  users: [
    ...demoUsers,
    {
      id: "u-lucas",
      name: "Lucas",
      username: "lucas",
      password: "lucas123",
      role: "alumno",
      siteId: "sede-norte",
      classId: "clase-3a",
      stats: {
        precision: 87,
        speed: 14,
        completedLevels: 1,
        points: 930,
      },
    },
    {
      id: "u-valen",
      name: "Valentina",
      username: "valen",
      password: "valen123",
      role: "alumno",
      siteId: "sede-norte",
      classId: "clase-3a",
      stats: {
        precision: 91,
        speed: 16,
        completedLevels: 2,
        points: 1140,
      },
    },
  ],
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
