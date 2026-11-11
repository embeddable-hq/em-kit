import { IconChevronLeft, IconChevronRight, IconMenu2 } from '@tabler/icons-react';
import { ReactNode, useEffect, useState } from 'react';
import { docsNav, NavLink } from '../docs/nav';

export type TocItem = { id: string; title: string; depth?: 2 | 3 };

const allLinks = docsNav.flatMap((s) => s.links);

// Highlights the section heading nearest the top of the viewport.
const useActiveHeading = (ids: string[]) => {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    setActive(ids[0]);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -65% 0px' },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return active;
};

const Sidebar = ({ route, onNavigate }: { route: string; onNavigate?: () => void }) => (
  <nav className="docs-sidebar__nav" aria-label="Documentation">
    {docsNav.map((section) => (
      <div key={section.title} className="docs-sidebar__section">
        <span className="docs-sidebar__title">{section.title}</span>
        <ul>
          {section.links.map((link) => (
            <li key={link.path}>
              <a
                href={link.path}
                className={route === link.path ? 'is-active' : ''}
                aria-current={route === link.path ? 'page' : undefined}
                onClick={onNavigate}
              >
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </nav>
);

const Pager = ({ route }: { route: string }) => {
  const index = allLinks.findIndex((l) => l.path === route);
  if (index === -1) return null;
  const prev: NavLink | undefined = allLinks[index - 1];
  const next: NavLink | undefined = allLinks[index + 1];
  return (
    <nav className="docs-pager" aria-label="Previous and next pages">
      {prev ? (
        <a href={prev.path} className="docs-pager__link">
          <span className="docs-pager__dir">
            <IconChevronLeft size={14} aria-hidden /> Previous
          </span>
          {prev.title}
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a href={next.path} className="docs-pager__link docs-pager__link--next">
          <span className="docs-pager__dir">
            Next <IconChevronRight size={14} aria-hidden />
          </span>
          {next.title}
        </a>
      )}
    </nav>
  );
};

// shadcn-style three columns: section sidebar, the page, and its contents.
export const DocsLayout = ({ route, toc, children }: { route: string; toc: TocItem[]; children: ReactNode }) => {
  const active = useActiveHeading(toc.map((t) => t.id));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [route]);

  return (
    <div className="docs-layout container container--wide">
      <aside className="docs-sidebar">
        <button
          type="button"
          className="docs-sidebar__toggle button button--small"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <IconMenu2 size={16} aria-hidden /> Menu
        </button>
        <div className={`docs-sidebar__panel${menuOpen ? ' is-open' : ''}`}>
          <Sidebar route={route} onNavigate={() => setMenuOpen(false)} />
        </div>
      </aside>
      <div className="docs-main">
        <article className="docs-article">{children}</article>
        <Pager route={route} />
      </div>
      {toc.length > 0 && (
        <aside className="docs-toc" aria-label="On this page">
          <span className="docs-toc__title">On this page</span>
          <ul>
            {toc.map((item) => (
              <li key={item.id} className={item.depth === 3 ? 'docs-toc__sub' : ''}>
                <a href={`#${item.id}`} className={active === item.id ? 'is-active' : ''}>
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
};
