/* Drizzle schema — mirrors db/init/001_schema.sql. The SQL file is the
   authoritative source of truth at deploy time (it runs in the Postgres
   container). This file exists so the API can do typed queries. */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  smallint,
  bigserial,
  timestamp,
  date,
  index,
  primaryKey,
  pgEnum,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "superadmin",
  "admin-general",
  "admin-sede",
  "profesor",
  "alumno",
]);

export const gradeEnum = pgEnum("grade_id", [
  "inicial",
  "1ep",
  "2ep",
  "3ep",
  "4ep",
  "5ep",
  "6ep",
  "sec",
  "libre",
]);

export const sedes = pgTable(
  "sedes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: text("city").notNull().default("Sin localidad"),
    photo: text("photo"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    activeIdx: index("idx_sedes_active").on(t.active),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRoleEnum("role").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    fullName: text("full_name").notNull(),
    username: text("username"),
    sedeId: uuid("sede_id").references(() => sedes.id, { onDelete: "set null" }),
    classId: uuid("class_id"),
    grade: gradeEnum("grade").notNull().default("libre"),
    googleSub: text("google_sub"),
    active: boolean("active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    temporaryPassword: boolean("temporary_password").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    usernameUnique: uniqueIndex("users_username_unique").on(t.username),
    googleSubUnique: uniqueIndex("users_google_sub_unique").on(t.googleSub),
    sedeRoleIdx: index("idx_users_sede_role").on(t.sedeId, t.role),
    roleIdx: index("idx_users_role").on(t.role),
  }),
);

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sedeId: uuid("sede_id")
      .notNull()
      .references(() => sedes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    grade: gradeEnum("grade").notNull(),
    year: integer("year"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sedeIdx: index("idx_classes_sede").on(t.sedeId),
  }),
);

export const classTeachers = pgTable(
  "class_teachers",
  {
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.classId, t.userId] }),
    userIdx: index("idx_class_teachers_user").on(t.userId),
  }),
);

export const classStudents = pgTable(
  "class_students",
  {
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.classId, t.userId] }),
    userIdx: index("idx_class_students_user").on(t.userId),
  }),
);

export const classWorlds = pgTable(
  "class_worlds",
  {
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    worldId: text("world_id").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.classId, t.worldId] }),
  }),
);

export const levelProgress = pgTable(
  "level_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    worldId: text("world_id").notNull(),
    levelNumber: integer("level_number").notNull(),
    completed: boolean("completed").notNull().default(true),
    bestAccuracy: smallint("best_accuracy").notNull(),
    bestWpm: smallint("best_wpm"),
    attempts: integer("attempts").notNull().default(1),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.worldId, t.levelNumber] }),
    userIdx: index("idx_level_progress_user").on(t.userId),
  }),
);

export const attempts = pgTable(
  "attempts",
  {
    id: bigserial("id", { mode: "bigint" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    worldId: text("world_id").notNull(),
    levelNumber: integer("level_number").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    accuracy: smallint("accuracy").notNull(),
    wpm: smallint("wpm"),
    errorCount: integer("error_count").notNull().default(0),
    completed: boolean("completed").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.id, t.endedAt] }),
    userTimeIdx: index("idx_attempts_user_time").on(t.userId, t.endedAt),
  }),
);

/* Persisted gamification stats per student (F5). Updated on level complete. */
export const studentStats = pgTable("student_stats", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  stars: integer("stars").notNull().default(0),
  levelsCompleted: integer("levels_completed").notNull().default(0),
  streakDays: integer("streak_days").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDay: date("last_active_day"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentAchievements = pgTable(
  "student_achievements",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.achievementId] }) }),
);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name"),
  role: userRoleEnum("role").notNull(),
  sedeId: uuid("sede_id").references(() => sedes.id, { onDelete: "set null" }),
  classId: uuid("class_id").references(() => classes.id, { onDelete: "set null" }),
  tokenHash: text("token_hash").notNull().unique(),
  status: text("status").notNull().default("pending"),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type DbUser = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type DbSede = typeof sedes.$inferSelect;
export type DbClass = typeof classes.$inferSelect;
export type DbLevelProgress = typeof levelProgress.$inferSelect;
export type NewLevelProgress = typeof levelProgress.$inferInsert;
export type DbAttempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type Role = (typeof userRoleEnum.enumValues)[number];
export type Grade = (typeof gradeEnum.enumValues)[number];
