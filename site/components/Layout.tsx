import { IconMenu2, IconX } from '@tabler/icons-react';
import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { BRAND } from '../config';
import { Sidebar } from './DocsLayout';
import { SearchButton } from './SearchButton';

// The first page of the docs; the guides and the component pages are all under /docs.
const docsHome = '/docs/quick-start';

const isComponents = (r: string) => r === '/docs/components' || r.startsWith('/docs/components/');

const links = [
  { label: 'Docs', path: docsHome, match: (r: string) => r.startsWith('/docs') && !isComponents(r) },
  { label: 'Components', path: '/docs/components', match: isComponents },
  { label: 'Examples', path: '/examples', match: (r: string) => r.startsWith('/examples') },
];

const isDocs = (route: string) => route.startsWith('/docs');

const NavLinks = ({ route, onNavigate, label }: { route: string; onNavigate?: () => void; label: string }) => (
  <nav aria-label={label}>
    {links.map((link) => {
      const active = link.match(route);
      return (
        <a
          key={link.path}
          className={active ? 'is-active' : ''}
          aria-current={active ? 'page' : undefined}
          href={link.path}
          onClick={onNavigate}
        >
          {link.label}
        </a>
      );
    })}
  </nav>
);

// Below 860px the links and, on docs pages, the sidebar share one menu.
const MenuButton = ({ route }: { route: string }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  // A new page, or a wider window, closes the menu.
  useEffect(() => setOpen(false), [route]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 861px)');
    const onChange = () => query.matches && setOpen(false);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('is-menu-open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
      }
    };
    // Tabbing out of the menu, either way, closes it rather than wandering into the page behind.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.body.classList.remove('is-menu-open');
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="nav__icon-button nav__menu-button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <IconX size={20} aria-hidden /> : <IconMenu2 size={20} aria-hidden />}
      </button>
      <div id={panelId} ref={panelRef} className="mobile-menu" hidden={!open}>
        {open && (
          <div className="mobile-menu__body" data-sidebar-scroll>
            <div className="mobile-menu__links">
              <NavLinks route={route} label="Site pages" onNavigate={() => close()} />
            </div>
            {isDocs(route) && <Sidebar route={route} onNavigate={() => close()} />}
          </div>
        )}
      </div>
    </>
  );
};

export const Layout = ({ route, children }: { route: string; children: ReactNode }) => (
  <div className="site">
    <a className="skip-link" href="#content">
      Skip to content
    </a>
    <header className="nav">
      <div className="nav__inner container container--wide">
        <div className="nav__id">
          <a className="nav__brand" href="/">
            <span className="nav__logo" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {BRAND.name}
          </a>
          <a className="nav__by" href={BRAND.maker.url}>
            by {BRAND.maker.name}
          </a>
        </div>
        <div className="nav__links">
          <NavLinks route={route} label="Main" />
        </div>
        <div className="nav__controls">
          <SearchButton />
          <MenuButton route={route} />
        </div>
      </div>
    </header>
    <main id="main">{children}</main>
    <footer className="footer">
      <div className="container container--wide footer__inner">
        <div className="footer__about">
          <p>
            {BRAND.name} is by <a href={BRAND.maker.url}>{BRAND.maker.name}</a>, MIT licensed and built on{' '}
            <a href="https://www.chartjs.org">Chart.js</a>.
          </p>
          <p>
            Need more than charts? <a href={BRAND.maker.url}>{BRAND.maker.name}</a>
            {BRAND.platform.slice(BRAND.maker.name.length)}
          </p>
        </div>
        <nav aria-label="Footer">
          <a href={docsHome}>Docs</a>
          <a href="/docs/components">Components</a>
          <a href="/examples">Examples</a>
          <a href="/llms.txt">llms.txt</a>
        </nav>
      </div>
    </footer>
  </div>
);
