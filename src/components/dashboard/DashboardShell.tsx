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
  /** Robot illustration shown in the sidebar. */
  sidebarMascot: string;
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

/* Premium Typely dashboard shell: elegant glass sidebar + cloud hero +
   content area. Shared by superadmin / sede-admin / teacher so every admin
   surface feels like the same magical world, adapted for grown-ups. */
export function DashboardShell({
  accent = "violet",
  roleLabel,
  roleSubtitle,
  roleIcon: RoleIcon,
  account,
  sidebarMascot,
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
    <div className={`dash-shell dash-shell--${accent} page-fade`}>
      <div className="dash-atmosphere" aria-hidden="true" />

      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="brand__text">TYPELY</span>
        </div>

        <div className="dash-role-card">
          <span className="dash-role-card__icon">
            <RoleIcon size={20} />
          </span>
          <div>
            <strong>{roleLabel}</strong>
            <span>{roleSubtitle}</span>
          </div>
        </div>

        <nav className="dash-nav" aria-label="Navegación">
          {nav.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              type="button"
              className={id === activeId ? "is-active" : ""}
              onClick={() => onNavigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {badge ? <em className="dash-nav__badge">{badge}</em> : null}
            </button>
          ))}
        </nav>

        <img className="dash-sidebar__mascot" src={sidebarMascot} alt="" decoding="async" loading="lazy" />

        <div className="dash-footer">
          <div className="dash-account">
            <span className="dash-account__avatar">{account.initial}</span>
            <div className="dash-account__info">
              <strong>{account.name}</strong>
              {account.email ? <span>{account.email}</span> : null}
            </div>
          </div>
          <button type="button" className="dash-logout" onClick={onLogout}>
            <LogOut size={17} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          {search ? (
            <label className="dash-search">
              <Search size={18} />
              <input
                type="search"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder ?? "Buscar…"}
              />
            </label>
          ) : (
            <span />
          )}
          <div className="dash-topbar__right">
            <button type="button" className="dash-bell" onClick={onBell} aria-label="Notificaciones">
              <Bell size={20} />
              {bellCount ? <em>{bellCount}</em> : null}
            </button>
            <span className="dash-topbar__avatar">{account.initial}</span>
          </div>
        </header>

        <section className="dash-hero">
          <div className="dash-hero__copy">{hero}</div>
          {heroArt ? (
            <div className="dash-hero__art" aria-hidden="true">
              {heroArt.mascot ? <img className="dash-hero__robot" src={heroArt.mascot} alt="" decoding="async" /> : null}
              {heroArt.island ? <img className="dash-hero__island" src={heroArt.island} alt="" decoding="async" /> : null}
            </div>
          ) : null}
        </section>

        <div className="dash-content">{children}</div>
      </div>
    </div>
  );
}

/* ---- Small presentational helpers shared by the dashboards ---- */

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
      className={`kpi-card kpi-card--${tone} ${onClick ? "is-clickable" : ""}`}
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
      <span className="kpi-card__icon">
        <Icon size={24} />
      </span>
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        <strong className="kpi-card__value">{value}</strong>
        {trend ? <span className="kpi-card__trend">{trend}</span> : null}
      </div>
    </article>
  );
}
