import { ReactNode } from 'react';
import { BRAND } from '../config';
import { SearchButton } from './SearchDialog';

const links = [
  { label: 'Docs', path: '/docs/introduction', match: (r: string) => r.startsWith('/docs') && !r.startsWith('/docs/components') },
  { label: 'Components', path: '/docs/components', match: (r: string) => r.startsWith('/docs/components') },
  { label: 'Gallery', path: '/charts', match: (r: string) => r.startsWith('/charts') },
  { label: 'Examples', path: '/examples', match: (r: string) => r.startsWith('/examples') },
];

export const Layout = ({ route, children }: { route: string; children: ReactNode }) => (
  <div className="site">
    <a className="skip-link" href="#main">
      Skip to content
    </a>
    <header className="nav">
      <div className="nav__inner container container--wide">
        <a className="nav__brand" href="/">
          <span className="nav__logo" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          {BRAND.name}
        </a>
        <nav className="nav__links" aria-label="Main">
          {links.map((link) => (
            <a
              key={link.path}
              className={link.match(route) ? 'is-active' : ''}
              aria-current={link.match(route) ? 'page' : undefined}
              href={link.path}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="nav__controls">
          <SearchButton />
          <a className="button button--small button--primary nav__cta" href="/docs/quick-start">
            Get started
          </a>
        </div>
      </div>
    </header>
    <main id="main">{children}</main>
    <footer className="footer">
      <div className="container container--wide footer__inner">
        <span>{BRAND.name} · MIT licensed · Built on Chart.js</span>
        <span>
          <a href="/docs/introduction">Docs</a> · <a href="/docs/components">Components</a> ·{' '}
          <a href="/charts">Gallery</a> · <a href="/examples">Examples</a>
        </span>
      </div>
    </footer>
  </div>
);
