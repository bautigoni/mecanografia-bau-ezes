# TYPELY — Arquitectura de la experiencia "Admin de Sede" (y base SaaS escolar)

> Documento de diseño de producto + arquitectura funcional/de datos.
> Estética: islas flotantes, pastel, glassmorphism suave, premium pero
> amigable para primaria. Inspiración UX: **Matific, Duolingo for Schools,
> Khan Academy Kids, ClassDojo, Google Classroom**.
>
> Estado: **spec**. Marca cada item como ✅ (existe), 🔶 (parcial), ⬜ (falta).

---

## 0. Filosofía

TYPELY **no** es un LMS tradicional: es *Matific + TypingClub + Duolingo* para
alfabetización digital de primaria. Por eso la UX se parte en dos modos:

| Intención | Patrón | Ejemplos |
| --- | --- | --- |
| **Acción rápida** (crear/editar UNA entidad, asignar, invitar) | **Modal / Drawer** | Crear curso, invitar docente, editar alumno, asignar docente |
| **Analizar / ver detalle** | **Pantalla completa** | Dashboard, lista de cursos, detalle de curso, progreso |

Reglas duras:
- **Nunca** mezclar cursos + docentes + alumnos en una sola vista saturada.
- Crear/editar una entidad = modal. Analizar = pantalla. Detalle = pantalla.
- Todo dato persiste en Postgres y respeta RBAC por sede (multi-tenant).

---

## 1. Arquitectura de navegación — Admin de Sede

Sidebar (glass, igual al `DashboardShell` actual):

```
TYPELY
[Sede Principal ▾]              ← selector de año lectivo arriba (2026 ▾)
─────────────
🏠 Inicio          /admin-sede
📚 Cursos          /admin-sede/cursos
🎓 Docentes        /admin-sede/docentes
👦 Alumnos         /admin-sede/alumnos
📈 Progreso        /admin-sede/progreso
⚙️  Configuración   /admin-sede/config
─────────────
[avatar] Goni Bauti
Cerrar sesión
```

Rutas completas (pantallas) y sus modales:

| Ruta | Tipo | Modales que dispara |
| --- | --- | --- |
| `/admin-sede` | Dashboard | Invitar docente, Crear curso, Crear alumno |
| `/admin-sede/cursos` | Lista | Crear curso (modal), Filtros |
| `/admin-sede/cursos/:id` | **Detalle con tabs** | Editar curso, Asignar docente, Agregar alumno, Carga masiva, Mover alumno |
| `/admin-sede/docentes` | Lista | Invitar docente, Crear docente |
| `/admin-sede/docentes/:id` | Detalle | Editar docente, Reasignar |
| `/admin-sede/alumnos` | Lista | Editar alumno, Mover de curso, Reset password |
| `/admin-sede/alumnos/:id` | Detalle (estilo Duolingo) | — |
| `/admin-sede/progreso` | Vista ejecutiva | Export |
| `/admin-sede/config` | Config de sede | Archivar/cerrar año |

> Nota: el `:id` de curso reemplaza el modal "abrir curso" actual.

---

## 2. Pantallas — wireframes en texto

### 2.1 INICIO (dashboard ejecutivo) `/admin-sede`

```
┌───────────────────────────────────────────────────────────────┐
│ Hola, {nombre} 👋     Sede Principal · Año 2026   [Invitar][+Curso]│
├───────────────────────────────────────────────────────────────┤
│ KPI row (6 tarjetas glass):                                     │
│ [Cursos 12] [Docentes 8] [Alumnos 240] [Activos hoy 86]         │
│ [Actividad semanal ▲12%] [Progreso prom. 64%]                   │
├──────────────────────────────┬────────────────────────────────┤
│ 📊 Actividad (línea, 7 días)  │ 🔔 Alertas (lista)             │
│  ▁▃▅▇▆▅▇  sesiones/día        │ • 3 cursos sin actividad 7d    │
│                              │ • 5 alumnos en riesgo          │
│                              │ • 1 docente sin ingresar 14d   │
├──────────────────────────────┴────────────────────────────────┤
│ ⚠️ Cursos que necesitan atención (cards horizontales)          │
│ [1ºA · 0% esta semana] [2ºB · 4 en riesgo] [KA · sin docente]  │
├───────────────────────────────────────────────────────────────┤
│ 🕑 Actividad reciente (timeline)                               │
│ • Sofía completó "Mundo letras" · hace 5m                      │
│ • Se creó el curso "3ºC" · hace 1h                             │
└───────────────────────────────────────────────────────────────┘
```

Componentes: `KpiCard` ✅ (ya existe), `LineChart`, `AlertList`, `AttentionCard`,
`ActivityFeed`.

### 2.2 CURSOS (lista) `/admin-sede/cursos`

```
┌───────────────────────────────────────────────────────────────┐
│ Cursos            [🔍 Buscar]  [Grado ▾][Turno ▾][Año ▾]  [+Crear curso]│
├───────────────────────────────────────────────────────────────┤
│ Grid de CourseCard (3 col):                                     │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│ │● 1ºA   grado 1│ │● 2ºB   grado 2│ │● KA  inicial  │  ← color  │
│ │👦 25  🎓 2     │ │👦 22  🎓 1     │ │👦 18  🎓 3     │  identif. │
│ │▓▓▓▓░ 64%      │ │▓▓░░░ 31%      │ │▓▓▓▓▓ 88%      │  progreso │
│ │últ. act: hoy  │ │últ: hace 8d ⚠ │ │últ: ayer      │          │
│ └───────────────┘ └───────────────┘ └───────────────┘          │
└───────────────────────────────────────────────────────────────┘
```

`CourseCard`: nombre, grado, color, #alumnos, #docentes, progreso promedio,
última actividad (con ⚠ si > 7 días). Click → detalle.

**Crear curso = MODAL** con: Nombre, Grado, Turno (mañana/tarde), Color.

### 2.3 DETALLE DE CURSO `/admin-sede/cursos/:id` — vista de gestión con TABS

```
┌───────────────────────────────────────────────────────────────┐
│ ← Volver   ● 1ºA · grado 1 · turno mañana · 2026   [Editar][⋯] │
│ [ Resumen ][ Alumnos ][ Docentes ][ Progreso ][ Configuración ]│
├───────────────────────────────────────────────────────────────┤
│ (contenido de la tab activa)                                    │
└───────────────────────────────────────────────────────────────┘
```

**Tab Resumen:** KPIs del curso (progreso prom., activos hoy, en riesgo),
mini-gráfico de actividad, lista corta "alumnos con dificultades".

**Tab Alumnos:** tabla moderna
`Avatar | Nombre | Usuario | Última conexión | Nivel | Progreso | Estado`
Acciones por fila: Editar, Reset password, Mover de curso, Eliminar.
Header: `[+ Agregar alumno]  [⬆ Carga masiva]  [🖨 Tarjetas de login]`.
Carga masiva = modal con textarea (un nombre por línea) o CSV.

**Tab Docentes:** chips de docentes asignados (con quitar) + `[Asignar docente ▾]`
+ mini-stats por docente (alumnos a cargo, último ingreso).

**Tab Progreso (estilo Matific):** heatmap/tabla
`Alumno | Escritura | Mouse | Atajos | Mundo actual | Riesgo 🟢🟡🔴`
Colores → un docente detecta problemas en < 10s.

**Tab Configuración:** Renombrar, Cambiar grado/turno/color, **Archivar curso**,
Eliminar curso.

### 2.4 DOCENTES (lista) `/admin-sede/docentes`

```
[🔍 Buscar] [Curso ▾][Nivel acceso ▾][Últ. ingreso ▾]   [+ Invitar docente]
Tabla: Nombre | Email | Cursos asignados | #Alumnos | Última actividad | ⋯
```
Click → detalle de docente: info, cursos asignados, stats, actividad reciente.

### 2.5 ALUMNOS (lista) `/admin-sede/alumnos`

```
[🔍 Buscar] [Curso ▾][Grado ▾][Progreso ▾][Estado ▾]  [⬆ Carga masiva]
Tabla: Año | Curso | Nombre | Usuario | Contraseña(mostrar) | Últ. conexión | ⋯
```
Click → **detalle de alumno (estilo Duolingo for Schools)**:

```
[Avatar]  Sofía Pérez · 1ºA · grado 1
Mundo actual: M3 · Nivel 12 · XP 1.240 · 🔥 racha 5 días
[▓▓▓▓░░ 64% del recorrido]
─ Tiempo de uso: 3h 20m   Actividades: 48   Precisión prom: 72%
─ Fortalezas: fila central · Debilidades: tildes, mayúsculas
─ Errores frecuentes: ñ, á, signos ¿¡
🕑 Timeline de actividad (por día)
```

### 2.6 PROGRESO (ejecutivo) `/admin-sede/progreso`

Vista para directivos: rendimiento por **grado / curso / docente**, tendencias
semanales, **heatmap** de alumnos en riesgo, ranking de cursos. Exportable.

### 2.7 CONFIGURACIÓN `/admin-sede/config`

Datos de la sede, logo, **año lectivo activo**, cerrar/abrir año, archivar
cursos, promover alumnos.

---

## 3. Componentes reutilizables

| Componente | Uso | Estado |
| --- | --- | --- |
| `DashboardShell` (sidebar+hero) | todas las pantallas admin | ✅ |
| `KpiCard` | dashboards | ✅ |
| `DataTable` (sortable, search, paginado, acciones por fila) | alumnos/docentes/cursos | ⬜ |
| `EntityModal` / `Drawer` (form genérico) | crear/editar | 🔶 (hay modales sueltos) |
| `CourseCard` | grid de cursos | 🔶 |
| `Tabs` | detalle de curso | ⬜ |
| `RiskBadge` 🟢🟡🔴 | progreso | ⬜ |
| `SkillHeatmap` | progreso por skill | ⬜ |
| `LineChart` / `Sparkline` | actividad | ⬜ |
| `AlertList` / `ActivityFeed` | dashboard | ⬜ |
| `BulkImportModal` (textarea/CSV) | carga masiva | 🔶 (hecho en CourseDetailPage) |
| `LoginCardsPrint` (imprimible) | alumnos chicos | ⬜ |

---

## 4. Modelo de datos (entidades)

Ya existen tablas: `sedes`, `users`, `classes`, `class_teachers`,
`class_students`, `class_worlds`, `level_progress`, `invitations`,
`refresh_tokens`. Hay que **agregar/repensar**:

```
School (= sede) ✅            AcademicYear ⬜            Course (= class) 🔶
  id                            id (2026)                 + academicYearId ⬜
  nombre, ciudad, logo          schoolId                  + turno ⬜
  estado/licencia ⬜            activo                     + color ⬜
                                                          + estado: activo|archivado ⬜

User ✅ (rol, sede, activo)    Teacher = User(rol=profesor) ✅
Student = User(rol=alumno) ✅  + nivelActual, xp, estrellas, racha ⬜ (tabla student_stats)

Activity ✅ (data/activities)  Assignment ⬜ (activity↔course, fechaEntrega)
Progress ✅ (level_progress: score, precisión, errores, tiempo)
Achievement ⬜ (catálogo)      StudentAchievement ⬜
Alert ⬜ (generadas)           AuditLog ⬜
```

**Año lectivo (crítico, diseñarlo ya):**
- `academic_years (id, school_id, label '2026', starts_at, ends_at, is_active)`.
- `courses.academic_year_id` → un curso pertenece a un año (`1ºA-2026` ≠ `1ºA-2027`).
- Cerrar año: marcar cursos `archivado`, **conservar** progreso, **promover**
  alumnos (crea matrícula en el curso del año siguiente, mantiene histórico).
- `student_enrollment (student_id, course_id, academic_year_id, status: cursando|egresado|promovido)` para historial multi-año.

**XP / progreso (tabla `student_stats` por alumno):**
- `xp` (completar nivel, mundo, racha diaria, precisión alta), `stars` (1–3 por
  nivel según precisión), `streak_days`, `last_active_at`, `current_world`,
  `current_level`.

---

## 5. RBAC / permisos (resumen)

| | Superadmin | Admin-sede | Docente | Alumno |
| --- | --- | --- | --- | --- |
| Crear/suspender sedes, licencias | ✅ | — | — | — |
| Ver cualquier sede | ✅ | — | — | — |
| Contenido educativo global | ✅ | — | — | — |
| Crear cursos/docentes/alumnos | ✅ | ✅ (su sede) | — | — |
| Asignar docente a curso | ✅ | ✅ | — | — |
| Invitar usuarios | ✅ | ✅ | — | — |
| Ver stats | global | su sede | sus cursos | propio |
| Asignar actividades | ✅ | ✅ | ✅ (sus cursos) | — |
| Jugar / logros / mundos | — | — | — | ✅ |

Ya implementado en `api/src/rbac.ts` (`canGrantRole`, `canActOnSede`) ✅. Falta
extender a Assignment/Progress/AuditLog.

---

## 6. Sistema de progreso, XP, estrellas, logros ⬜

- **XP:** nivel completado (+10), mundo completado (+50), racha diaria (+5),
  precisión ≥90% (+5 bonus).
- **Estrellas:** 1–3 por nivel según precisión (ya se calcula en gameplay ✅);
  persistir agregado en `student_stats`.
- **Logros** (catálogo `achievements`): Primera letra, Primer mundo, 100
  actividades, 7 días seguidos, 100% precisión, etc. → `student_achievements`.

---

## 7. Estadísticas / métricas (cálculo) ⬜

- **Por actividad:** tiempo, errores, precisión, intentos (ya en `level_progress`).
- **Por alumno:** tiempo total, actividades completadas, nivel, racha.
- **Por curso:** promedio, ranking, participación (% activos/semana).
- **Por sede:** actividad diaria/semanal, progreso promedio.
- Endpoints de agregación (ver §11). Cachear/materializar para escalar.

---

## 8. Alertas automáticas ⬜

Job/cron + cálculo on-read:
- **Alumno:** 7 días sin ingresar · precisión < 60% · muchas actividades abandonadas.
- **Curso:** sin actividad reciente (>7d) · sin docente asignado.
- **Docente:** no ingresó en 14 días.
- Tabla `alerts (scope, entity_id, type, severity, created_at, resolved)`.

---

## 9. Invitaciones / onboarding 🔶

- **Docente:** admin crea/invita → email vía **Resend** ✅ → acepta y setea pass
  o entra con **Google** ✅. (Ya funciona.)
- **Alumno chico (modo simple) ⬜:** generar `usuario` + `contraseña visual`
  (palabra+ícono), **tarjetas imprimibles** de login por curso.

---

## 10. Auditoría ⬜

`audit_log (id, actor_id, action, entity_type, entity_id, meta jsonb, at)`.
Registrar: alta/baja de usuarios, cambios de curso, cambios de rol, logins.

---

## 11. Endpoints backend (mapa)

**Existen ✅:** `auth/*`, `sedes`, `users` (CRUD+reset), `classes` (CRUD +
**members/assign-teacher/worlds** recién agregados), `invitations`, `progress`,
`import`.

**Faltan ⬜ (admin-sede + dashboards):**
```
GET  /admin/overview?sedeId           → KPIs del dashboard
GET  /courses/:id/summary             → KPIs del curso
GET  /courses/:id/progress            → tabla skills/riesgo
GET  /students/:id                    → detalle alumno (stats, timeline)
GET  /teachers/:id                    → detalle docente
GET  /progress/overview?sedeId        → vista ejecutiva (grado/curso/docente)
GET  /alerts?sedeId                   → alertas
POST /users/bulk                      → alta masiva (alumnos/docentes)
PATCH/POST academic-years, courses/:id/archive, courses/:id/promote
POST /courses/:id/students/:uid/move  → mover alumno de curso
GET  /audit?sedeId
```

---

## 12. Estado actual vs. objetivo (gap)

**Ya hecho ✅:** backend real (Postgres+Fastify+Drizzle), auth+Google+Resend,
sedes/users/classes CRUD, **asignar docente / members / niveles por curso**
(recién), `CourseDetailPage` (asignar docente, alta simple+masiva, reset pass,
toggles de niveles), progreso por nivel persistido, RBAC base.

**Falta ⬜:** dashboards con métricas reales, listas dedicadas (Cursos/Docentes/
Alumnos) con `DataTable`, detalle de alumno/docente, tab de progreso heatmap,
XP/estrellas/logros/student_stats, alertas, auditoría, **año lectivo + archivado
+ promoción**, carga masiva de docentes, tarjetas imprimibles, año/turno/color en
curso.

---

## 13. Roadmap por fases (propuesto)

- **F1 — Esqueleto de navegación + listas (semana 1):** sidebar definitivo,
  pantallas `Cursos`, `Docentes`, `Alumnos` con `DataTable` real + búsqueda/
  filtros; `CourseCard`; crear/editar como modales. (Reusar lo del backend ya hecho.)
- **F2 — Detalle de curso con tabs:** Resumen/Alumnos/Docentes/Progreso/Config.
  Endpoints `summary`, `progress`. Carga masiva + tarjetas imprimibles.
- **F3 — Dashboard + métricas + alertas:** `/admin/overview`, gráficos, alertas.
- **F4 — Progreso ejecutivo + detalle alumno/docente** (estilo Duolingo/Matific).
- **F5 — XP/estrellas/logros + student_stats.**
- **F6 — Año lectivo + archivado + promoción + auditoría.**

> Cada fase se entrega y deploya funcionando, sin romper lo existente.
```
```
