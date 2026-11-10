import { ReactNode } from 'react';
import { BRAND } from '../config';
import { href } from '../router';

export const Layout = ({ route, children }: { route: string; children: ReactNode }) => {
  const isActive = (prefix: string) => (route.startsWith(prefix) ? 'is-active' : '');
  return (
    <div className="site">
      <header className="nav">
        <div className="nav__inner container">
          <a className="nav__brand" href={href('/')}>
            <span className="nav__logo" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {BRAND.name}
          </a>
          <nav className="nav__links" aria-label="Main">
            <a className={isActive('/charts')} href={href('/charts')}>
              Charts
            </a>
            <a className={isActive('/docs')} href={href('/docs')}>
              Docs
            </a>
            <a className={isActive('/examples')} href={href('/examples')}>
              Examples
            </a>
          </nav>
          <div className="nav__controls">
            <a className="button button--small button--primary" href={href('/docs')}>
              Get started
            </a>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="container footer__inner">
          <span>
            {BRAND.name} · MIT licensed · Built on Chart.js
          </span>
          <span>
            <a href={href('/charts')}>Charts</a> · <a href={href('/docs')}>Docs</a> ·{' '}
            <a href={href('/examples')}>Examples</a>
          </span>
        </div>
      </footer>
    </div>
  );
};
