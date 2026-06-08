import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Bell, LogOut, Search } from "lucide-react";

export type DashAccent = "violet" | "green" | "blue";

export interface DashNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface DashboardShellProps {
  accent?: DashAccent;
  /** Sidebar role chip, e.g. "SUPERADMIN". */
  roleLabel: string;
  roleSubtitle: string;
  roleIcon: LucideIcon;
  account: { name: string; email?: string; initial: string };
  /** Deprecated — the sidebar robot was removed so the footer logout is
   *  always visible. Kept optional so existing callers don't break. */
  sidebarMascot?: string;
  nav: DashNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  /** Optional live search wired by the page. */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** Bell click handler (e.g. surface a toast). */
  onBell?: () => void;
  bellCount?: number;
  /** Hero header content (title/subtitle/actions). */
  hero: ReactNode;
  /** Decorative floating art for the hero (robot + island). */
  heroArt?: { mascot?: string; island?: string };
  children: ReactNode;
}

/* Accent → gradient mapping for the atmospheric background overlay. */
const ACCENT_GRADIENT: Record<DashAccent, string> = {
  violet:
    "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(156,113,255,0.18), transparent 60%)," +
    "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(51,199,240,0.12), transparent 55%)",
  green:
    "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(89,205,183,0.20), transparent 60%)," +
    "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(51,199,240,0.12), transparent 55%)",
  blue:
    "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(51,199,240,0.20), transparent 60%)," +
    "radial-gradient(ellipse 60% 50% at 80% 80%, rgba(95,140,255,0.12), transparent 55%)",
};

/* Accent → ring colour for the active nav pill. */
const ACCENT_RING: Record<DashAccent, string> = {
  violet: "ring-accent/50 bg-accent/10 text-accent-strong",
  green: "ring-mint/50 bg-mint/10 text-mint",
  blue: "ring-accent-sky/50 bg-accent-sky/10 text-accent-sky",
};

/* Premium Typely dashboard shell: elegant glass sidebar + cloud hero +
   content area. Shared by superadmin / sede-admin / teacher so every admin
   surface feels like the same magical world, adapted for grown-ups. */
export function DashboardShell({
  accent = "violet",
  roleLabel,
  roleSubtitle,
  roleIcon: RoleIcon,
  account,
  nav,
  activeId,
  onNavigate,
  onLogout,
  search,
  onBell,
  bellCount,
  hero,
  heroArt,
  children,
}: DashboardShellProps) {
  return (
    <div className="grid grid-cols-[auto_1fr] h-dvh overflow-hidden animate-page-fade">
      {/* Atmospheric gradient overlay — purely decorative. */}
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        style={{ background: ACCENT_GRADIENT[accent] }}
        aria-hidden="true"
      />

      <aside className="sticky top-0 h-dvh glass flex flex-col gap-3 p-4 w-[clamp(14rem,18vw,16rem)]">
        {/* ── Brand ── */}
        <div className="flex items-center gap-2.5 px-1">
          <span className="grid place-items-center w-9 h-9 rounded-[1.05rem] border border-white/95 bg-gradient-to-br from-accent-sky/30 via-accent/20 to-accent-teal/15 shadow-card text-accent-strong font-black text-lg">
            T
          </span>
          <span className="text-[clamp(1.25rem,2vw,1.55rem)] font-black text-text">
            TYPELY
          </span>
        </div>

        {/* ── Role chip ── */}
        <div className="glass-surface flex items-center gap-2.5 p-3 rounded-xl">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-accent/15 text-accent-strong">
            <RoleIcon size={20} />
          </span>
          <div className="flex flex-col leading-tight">
            <strong className="text-text text-sm font-extrabold">{roleLabel}</strong>
            <span className="text-muted text-xs">{roleSubtitle}</span>
          </div>
        </div>

        {/* ── Navigation (grows + scrolls so the footer logout always pins
            to the bottom and stays visible) ── */}
        <nav className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto" aria-label="Navegación">
          {nav.map(({ id, label, icon: Icon, badge }) => {
            const isActive = id === activeId;
            return (
              <button
                key={id}
                type="button"
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? `${ACCENT_RING[accent]} ring-2 shadow-sm`
                    : "text-muted hover:bg-white/50 hover:text-text"
                }`}
                onClick={() => onNavigate(id)}
              >
                <Icon size={19} />
                <span>{label}</span>
                {badge ? (
                  <em className="ml-auto grid place-items-center min-w-[1.35rem] h-[1.35rem] px-1 rounded-full bg-rose text-white text-[10px] font-black not-italic">
                    {badge}
                  </em>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* ── Footer: account + logout (sidebar robot removed) ── */}
        <div className="mt-auto flex flex-col gap-3 pt-3 border-t border-white/40">
          <div className="flex items-center gap-3">
            <span className="grid place-items-center w-10 h-10 rounded-full bg-accent/15 text-accent-strong font-black text-sm shrink-0">
              {account.initial}
            </span>
            <div className="flex flex-col leading-tight min-w-0">
              <strong className="text-text text-sm font-extrabold truncate">{account.name}</strong>
              {account.email ? (
                <span className="text-muted text-xs truncate">{account.email}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-muted hover:bg-rose/10 hover:text-rose transition cursor-pointer"
            onClick={onLogout}
          >
            <LogOut size={17} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        {/* ── Top bar ── */}
        <header className="flex items-center justify-between gap-4 p-4">
          {search ? (
            <label className="glass-surface grid grid-cols-[auto_1fr] items-center gap-2.5 rounded-xl h-12 px-4 min-w-[14rem] max-w-md w-full">
              <Search size={18} className="text-muted shrink-0" />
              <input
                type="search"
                className="bg-transparent outline-none text-text placeholder:text-muted/60 w-full"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? "Buscar…"}
              />
            </label>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="relative grid place-items-center w-10 h-10 rounded-xl glass-surface text-muted hover:text-text transition cursor-pointer"
              onClick={onBell}
              aria-label="Notificaciones"
            >
              <Bell size={20} />
              {bellCount ? (
                <em className="absolute -top-1 -right-1 grid place-items-center min-w-[1.2rem] h-[1.2rem] px-1 rounded-full bg-rose text-white text-[10px] font-black not-italic">
                  {bellCount}
                </em>
              ) : null}
            </button>
            <span className="grid place-items-center w-10 h-10 rounded-full bg-accent/15 text-accent-strong font-black text-sm">
              {account.initial}
            </span>
            <button
              type="button"
              className="flex items-center gap-2 h-10 px-4 rounded-xl glass-surface text-sm font-bold text-muted hover:bg-rose/10 hover:text-rose transition cursor-pointer"
              onClick={onLogout}
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* ── Hero section ── */}
        <section className="glass-card-smooth p-6 rounded-2xl flex gap-4 mx-4 mb-2">
          <div className="flex-1 flex flex-col gap-2">{hero}</div>
          {heroArt ? (
            <div className="relative w-32 shrink-0 hidden sm:block" aria-hidden="true">
              {heroArt.mascot ? (
                <img
                  className="absolute -top-4 right-2 w-24 animate-mascot-float"
                  src={heroArt.mascot}
                  alt=""
                  decoding="async"
                />
              ) : null}
              {heroArt.island ? (
                <img
                  className="absolute bottom-0 right-0 w-20 animate-island-float opacity-80"
                  src={heroArt.island}
                  alt=""
                  decoding="async"
                />
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ── Scrollable content ── */}
        <div className="p-6 flex flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}

/* ---- Small presentational helpers shared by the dashboards ---- */

/* Tone → accent colour mapping for KPI cards. Drives the icon background
   and the optional left-border highlight via an inline CSS variable. */
const TONE_CLASSES: Record<string, string> = {
  violet: "bg-accent/15 text-accent-strong",
  green: "bg-mint/20 text-mint",
  blue: "bg-accent-sky/20 text-accent-sky",
  pink: "bg-accent-pink/20 text-accent-pink",
  gold: "bg-amber-200/40 text-amber-600",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  tone = "violet",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  trend?: string;
  tone?: "violet" | "green" | "blue" | "pink" | "gold";
  onClick?: () => void;
}) {
  return (
    <article
      className={`glass-surface p-4 rounded-xl flex items-start gap-3 transition-all duration-150 ${
        onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-card" : ""
      }`}
      onClick={onClick}
      /* When the card is actionable, expose it to keyboard + AT as a button. */
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${label}: ${value}` : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <span className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 ${TONE_CLASSES[tone] ?? TONE_CLASSES.violet}`}>
        <Icon size={24} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-muted text-xs font-bold uppercase tracking-wide">{label}</span>
        <strong className="text-text text-2xl font-black font-display">{value}</strong>
        {trend ? (
          <span className="text-accent-teal text-xs font-bold mt-0.5">{trend}</span>
        ) : null}
      </div>
    </article>
  );
}
