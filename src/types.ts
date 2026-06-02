export type Role = "superadmin" | "admin-general" | "admin-sede" | "profesor" | "alumno";

export type AccessStatus = "Activo" | "Inactivo";

export interface ActiveUser {
  id: string;
  name: string;
  username: string;
  /** Optional institutional email — used to match Google sign-ins. */
  email?: string;
  role: Role;
  siteId?: string;
  classId?: string;
  /** Account enabled flag. Used to deactivate sede admins without deleting
   *  them. Undefined is treated as active. */
  active?: boolean;
  /** When true, the user logged in with a temporary password and MUST set a
   *  new one before reaching any dashboard. Carried into the active session
   *  so route guards can enforce it. */
  mustChangePassword?: boolean;
}

export interface DemoUser extends ActiveUser {
  password: string;
  stats?: StudentStats;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  /** School/campus photo as a data URL (uploaded by the superadmin).
   *  Empty/undefined → a soft placeholder is rendered instead. */
  photo?: string;
  /** Whether the sede is currently active. Defaults to active. */
  active?: boolean;
}

/** Grade levels supported by the course-path system.
 *  "inicial" = Pre-K / Kindergarten
 *  "1ep"–"6ep" = Primaria 1º–6º
 *  "sec" = Secundaria
 *  "libre" = free-path (all worlds, teacher / admin use)       */
export type GradeId =
  | "inicial"
  | "1ep"
  | "2ep"
  | "3ep"
  | "4ep"
  | "5ep"
  | "6ep"
  | "sec"
  | "libre";

export interface ClassRoom {
  id: string;
  name: string;
  siteId: string;
  grade: GradeId;
  teacherIds: string[];
  studentIds: string[];
}

export interface AccessCode {
  id: string;
  role: string;
  site: string;
  code: string;
  status: AccessStatus;
}

export interface ActivityRecord {
  id: string;
  title: string;
  route: string;
  level: number;
}

export interface Assignment {
  id: string;
  classId: string;
  activityId: string;
  teacherId: string;
  createdAt: string;
}

export interface Attempt {
  id: string;
  userId: string;
  activityId: string;
  accuracy: number;
  errors: number;
  createdAt: string;
}

export interface Reward {
  id: string;
  userId: string;
  name: string;
  unlocked: boolean;
}

export type InvitationStatus = "pending" | "sent" | "accepted" | "expired";

/** An invitation for a teacher (or sede admin) to join a sede. The token
 *  is shareable via a link; email delivery is handled by a backend so no
 *  secret ever touches the frontend. */
export interface Invitation {
  id: string;
  email: string;
  name?: string;
  role: Role;
  siteId?: string;
  classId?: string;
  token: string;
  status: InvitationStatus;
  createdAt: string;
  sentAt?: string;
  acceptedAt?: string;
  invitedBy?: string;
}

export interface StudentStats {
  precision: number;
  speed: number;
  completedLevels: number;
  points: number;
}

export interface EduTicUser extends ActiveUser {
  password: string;
  stats?: StudentStats;
  /** True while the stored password is a system-generated temporary one. */
  temporaryPassword?: boolean;
  /** ISO timestamp of the last successful self-service password change. */
  passwordUpdatedAt?: string;
  /** ISO timestamp of the last superadmin-triggered password reset. */
  passwordResetAt?: string;
}

export interface DemoData {
  sites: Site[];
  classes: ClassRoom[];
  users: EduTicUser[];
  accessCodes: AccessCode[];
  activities?: ActivityRecord[];
  assignments?: Assignment[];
  attempts?: Attempt[];
  rewards?: Reward[];
  invitations?: Invitation[];
}
