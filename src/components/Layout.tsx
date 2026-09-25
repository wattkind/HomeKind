import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';

import { isFirstRunDone } from '../hooks/firstRun';
import { CogIcon, HomeIcon, ShieldIcon } from './Icons';

const TABS = [
  {
    to: '/',
    label: 'Devices',
    Icon: HomeIcon,
    match: (p: string) => p === '/' || p.startsWith('/devices'),
  },
  {
    to: '/warranties',
    label: 'Warranties',
    Icon: ShieldIcon,
    match: (p: string) => p.startsWith('/warranties'),
  },
  {
    to: '/settings',
    label: 'Settings',
    Icon: CogIcon,
    match: (p: string) => p.startsWith('/settings'),
  },
] as const;

/** App shell for every screen except the welcome screen: content plus bottom tab bar. */
export function Layout() {
  const { pathname } = useLocation();

  if (!isFirstRunDone()) {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <div className="shell">
      <Outlet />
      <nav className="tabbar" aria-label="Main">
        <ul className="tabbar__list">
          {TABS.map(({ to, label, Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={to}>
                <Link
                  to={to}
                  className={active ? 'tab tab--active' : 'tab'}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon />
                  <span className="tab__label">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
