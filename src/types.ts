export type Role = "admin-general" | "admin-sede" | "profesor" | "alumno";

export type AccessStatus = "Activo" | "Inactivo";

export interface ActiveUser {
  id: string;
  name: string;
  username: string;
  role: Role;
  siteId?: string;
  classId?: string;
}

export interface DemoUser extends ActiveUser {
  password: string;
  stats?: StudentStats;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  coordinator: string;
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

export interface StudentStats {
  precision: number;
  speed: number;
  completedLevels: number;
  points: number;
}

export interface EduTicUser extends ActiveUser {
  password: string;
  stats?: StudentStats;
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
}
