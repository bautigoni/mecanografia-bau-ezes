-- =====================================================================
-- TYPELY schema (v1) — applied automatically by the Postgres container
-- the first time the `dbdata` volume is empty (via /docker-entrypoint-initdb.d).
-- Idempotent where possible; intentionally NOT destructive: re-runs
-- against an already-initialised database are no-ops.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- Roles (enum) — kept in sync with src/types.ts and api/src/roles.ts.
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'superadmin',
    'admin-general',
    'admin-sede',
    'profesor',
    'alumno'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE grade_id AS ENUM (
    'inicial','1ep','2ep','3ep','4ep','5ep','6ep','sec','libre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Sedes (school campuses) — managed only by the superadmin.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sedes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  city        text NOT NULL DEFAULT 'Sin localidad',
  photo       text,                 -- data URL or remote https URL
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sedes_active ON sedes (active);

-- ---------------------------------------------------------------------
-- Users — every account, including the superadmin.
-- Email is citext (case-insensitive) and unique. Google sign-in matches
-- on this column after we normalise (trim+lowercase) on write.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role            user_role NOT NULL,
  email           citext UNIQUE NOT NULL,
  password_hash   text,             -- bcrypt; null for Google-only accounts
  full_name       text NOT NULL,
  username        text UNIQUE,
  sede_id         uuid REFERENCES sedes(id) ON DELETE SET NULL,
  class_id        uuid,             -- FK added after classes table exists
  grade           grade_id NOT NULL DEFAULT 'libre',
  google_sub      text UNIQUE,      -- Google "sub" claim, set on first Google login
  active          boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  temporary_password   boolean NOT NULL DEFAULT false,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_sede_role  ON users (sede_id, role);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);

-- ---------------------------------------------------------------------
-- Classes — a class belongs to a sede and has a grade.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id     uuid NOT NULL REFERENCES sedes(id) ON DELETE CASCADE,
  name        text NOT NULL,
  grade       grade_id NOT NULL,
  year        int,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_classes_sede ON classes (sede_id);

-- Now wire up users.class_id.
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_class_fk
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_users_class ON users (class_id);

-- ---------------------------------------------------------------------
-- class_teachers / class_students — many-to-many.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_teachers (
  class_id  uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_class_teachers_user ON class_teachers (user_id);

CREATE TABLE IF NOT EXISTS class_students (
  class_id  uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_class_students_user ON class_students (user_id);

-- ---------------------------------------------------------------------
-- Per-class island enablement (teacher's selection). NULL row = no
-- restriction (i.e. every grade-appropriate world is enabled).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_worlds (
  class_id   uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  world_id   text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (class_id, world_id)
);

-- ---------------------------------------------------------------------
-- Level progress — one row per (student, world, level). Best-result model
-- (the API keeps the highest accuracy; the "stars" derivation lives in
-- the shared typescript code so the rules stay in one place).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS level_progress (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  world_id       text NOT NULL,
  level_number   int  NOT NULL,
  completed      boolean NOT NULL DEFAULT true,
  best_accuracy  smallint NOT NULL CHECK (best_accuracy BETWEEN 0 AND 100),
  best_wpm       smallint,
  attempts       int NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, world_id, level_number)
);
CREATE INDEX IF NOT EXISTS idx_level_progress_user ON level_progress (user_id);

-- ---------------------------------------------------------------------
-- Attempts — append-only event log for analytics + audit. Partitioned
-- monthly so old data is cheap to drop / archive. The default partition
-- catches writes during the transition window.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attempts (
  id          bigserial,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  world_id    text NOT NULL,
  level_number int NOT NULL,
  started_at  timestamptz NOT NULL,
  ended_at    timestamptz NOT NULL,
  accuracy    smallint NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
  wpm         smallint,
  error_count int NOT NULL DEFAULT 0,
  completed   boolean NOT NULL,
  PRIMARY KEY (id, ended_at)
) PARTITION BY RANGE (ended_at);

CREATE INDEX IF NOT EXISTS idx_attempts_user_time
  ON attempts (user_id, ended_at DESC);

-- Catch-all partition — every row lands here until a monthly partition
-- is created. The API will manage monthly partitions (see api migration
-- runner) so a fresh DB never sees "no partition" errors.
CREATE TABLE IF NOT EXISTS attempts_default
  PARTITION OF attempts DEFAULT;

-- ---------------------------------------------------------------------
-- Invitations — Resend-backed shareable link. Token is hashed at rest.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext NOT NULL,
  name          text,
  role          user_role NOT NULL,
  sede_id       uuid REFERENCES sedes(id) ON DELETE SET NULL,
  class_id      uuid REFERENCES classes(id) ON DELETE SET NULL,
  token_hash    text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','sent','accepted','expired')),
  invited_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  accepted_at   timestamptz,
  expires_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations (lower(email));

-- ---------------------------------------------------------------------
-- Auth refresh tokens (server-side, revocable). Access tokens are JWTs
-- and never touch the DB; refresh tokens are stored hashed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------
-- updated_at trigger — keep stamps honest without a per-row reminder.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_sedes_updated  BEFORE UPDATE ON sedes  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_users_updated  BEFORE UPDATE ON users  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Gamification (F5) — also created idempotently on API boot via ensureSchema().
CREATE TABLE IF NOT EXISTS student_stats (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  stars integer NOT NULL DEFAULT 0,
  levels_completed integer NOT NULL DEFAULT 0,
  streak_days integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_day date,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS student_achievements (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
