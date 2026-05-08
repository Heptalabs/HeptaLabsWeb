import type { ReactNode } from 'react';
import type { AdminRole } from '../../types/admin';
import type { AdminNavKey } from '../../security/accessControl';

export type AdminLayoutNavItem = {
  key: AdminNavKey;
  label: string;
};

export type AdminLayoutProps = {
  title: string;
  subtitle: string;
  role: AdminRole;
  roleLabel: string;
  logoutLabel: string;
  currentNav: AdminNavKey;
  navItems: AdminLayoutNavItem[];
  onNavigate: (next: AdminNavKey) => void;
  onLogout: () => void;
  topbar?: ReactNode;
  children: ReactNode;
};

export const AdminLayout = ({
  title,
  subtitle,
  role,
  roleLabel,
  logoutLabel,
  currentNav,
  navItems,
  onNavigate,
  onLogout,
  topbar,
  children
}: AdminLayoutProps) => {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-kicker">IMWALLET</p>
          <h1>{title}</h1>
          <p className="brand-sub">{subtitle}</p>
        </div>

        <nav className="side-nav">
          {navItems.map((item) => (
            <button key={item.key} className={item.key === currentNav ? 'side-item active' : 'side-item'} onClick={() => onNavigate(item.key)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="side-card">
          <p className="side-card-title">{roleLabel}</p>
          <p className="side-card-value">{role}</p>
          <button className="ghost-btn" onClick={onLogout}>
            {logoutLabel}
          </button>
        </div>
      </aside>

      <main className="content">
        {topbar}
        {children}
      </main>
    </div>
  );
};
