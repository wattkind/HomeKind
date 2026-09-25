import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { BackIcon } from './Icons';

interface ScreenProps {
  title: string;
  /** When set, shows a back link to this route. */
  back?: { to: string; label: string };
  /** Optional control shown on the right of the header. */
  action?: ReactNode;
  children: ReactNode;
}

/** One screen: a safe-area-aware header with the screen's single `<h1>`, then `<main>`. */
export function Screen({ title, back, action, children }: ScreenProps) {
  useEffect(() => {
    document.title = title === 'Devices' ? 'HomeKind' : `${title} · HomeKind`;
  }, [title]);

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          {back ? (
            <Link to={back.to} className="icon-btn topbar__back" aria-label={back.label}>
              <BackIcon />
            </Link>
          ) : null}
          <h1 className="topbar__title">{title}</h1>
          {action ? <div className="topbar__action">{action}</div> : null}
        </div>
      </header>
      <main className="content" id="main">
        {children}
      </main>
    </>
  );
}
