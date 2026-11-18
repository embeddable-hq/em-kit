import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { docsNav, flatNav, NavLink } from '../content/nav';

/** What the skip link jumps to: the page's content column, focusable so the next Tab starts inside it. */
export const contentTarget = { id: 'content', tabIndex: -1 } as const;

export type TocItem = { id: string; title: string; depth?: 2 | 3 };

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

const SidebarLink = ({ link, route, onNavigate }: { link: NavLink; route: string; onNavigate?: () => void }) => (
  <li>
    <a
      href={link.path}
      className={route === link.path ? 'is-active' : ''}
      aria-current={route === link.path ? 'page' : undefined}
      onClick={onNavigate}
    >
      {link.title}
    </a>
  </li>
);

// The box that scrolls the sidebar, named by its data-sidebar-scroll attribute.
const sidebarScroller = (root: HTMLElement | null) => root?.closest<HTMLElement>('[data-sidebar-scroll]') ?? null;

// Where each sidebar box was scrolled to, kept across page changes: every page
// mounts a sidebar of its own (App.tsx keys pages by route), which would
// otherwise start at the top and then jump to the page's link.
const scrollPositions = new Map<string, number>();

// Brings the current page into view inside whichever box scrolls the sidebar,
// without moving the page itself.
const scrollCurrentIntoView = (root: HTMLElement | null) => {
  const link = root?.querySelector<HTMLElement>('[aria-current="page"]');
  const scroller = sidebarScroller(root);
  if (!root || !link || !scroller) return;
  const box = scroller.getBoundingClientRect();
  const within = (el: Element) => el.getBoundingClientRect().top - box.top + scroller.scrollTop;
  const top = within(link);
  const bottom = top + link.offsetHeight;
  const margin = 12;
  // Scroll only when the link is out of view, as scrollIntoView({ block: 'nearest' }) would.
  if (top >= scroller.scrollTop && bottom <= scroller.scrollTop + scroller.clientHeight) return;
  let next = top < scroller.scrollTop ? top - margin : bottom + margin - scroller.clientHeight;
  // Then land on the first heading or link that is whole, so no row is left half cut at the top.
  const rows = [...root.querySelectorAll('.docs-sidebar__title, .docs-sidebar__group-title, li > a')].map(within);
  const whole = rows.filter((y) => y >= next - 1 && y <= top).sort((x, y) => x - y)[0];
  if (whole !== undefined) next = whole - margin / 2;
  scroller.scrollTop = Math.max(0, next);
};

// Section, then (for components) type groups, then links: three levels at most.
export const Sidebar = ({ route, onNavigate }: { route: string; onNavigate?: () => void }) => {
  const ref = useRef<HTMLElement>(null);
  const ids = useId();
  // Both before the first paint, so the sidebar is never seen at the top and then moved.
  useLayoutEffect(() => {
    const scroller = sidebarScroller(ref.current);
    if (!scroller) return;
    const name = scroller.dataset.sidebarScroll ?? '';
    scroller.scrollTop = scrollPositions.get(name) ?? 0;
    const remember = () => scrollPositions.set(name, scroller.scrollTop);
    scroller.addEventListener('scroll', remember, { passive: true });
    return () => scroller.removeEventListener('scroll', remember);
  }, []);
  // Then, only when the page's link is out of view (a link in the page, search, or
  // a pager link led here), scroll to it: a click in the sidebar leaves it where it is.
  useLayoutEffect(() => scrollCurrentIntoView(ref.current), [route]);
  return (
    <nav className="docs-sidebar__nav" aria-label="Documentation" ref={ref}>
      {docsNav.map((section) => {
        const grouped = new Set((section.groups ?? []).flatMap((g) => g.links.map((l) => l.path)));
        return (
          <div key={section.title} className="docs-sidebar__section">
            <span className="docs-sidebar__title">{section.title}</span>
            <ul>
              {section.links
                .filter((l) => !grouped.has(l.path))
                .map((link) => (
                  <SidebarLink key={link.path} link={link} route={route} onNavigate={onNavigate} />
                ))}
              {(section.groups ?? []).map((group) => (
                <li key={group.title} className="docs-sidebar__group">
                  <span id={`${ids}-${group.title}`} className="docs-sidebar__group-title">
                    {group.title}
                  </span>
                  <ul aria-labelledby={`${ids}-${group.title}`}>
                    {group.links.map((link) => (
                      <SidebarLink key={link.path} link={link} route={route} onNavigate={onNavigate} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
};

/** Previous and next links in the docs' style: also the playground's and anywhere a page has neighbours. */
export const PagerLinks = ({ prev, next, label }: { prev?: NavLink; next?: NavLink; label: string }) => (
  <nav className="docs-pager" aria-label={label}>
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

const Pager = ({ route }: { route: string }) => {
  const index = flatNav.findIndex((l) => l.path === route);
  if (index === -1) return null;
  return <PagerLinks prev={flatNav[index - 1]} next={flatNav[index + 1]} label="Previous and next pages" />;
};

export type Crumb = { label: string; href?: string };

/**
 * The line above a page's H1: "Components · Bars". The last item is the
 * page's own parent or the page itself; items with an href are links.
 * Looks the same on component pages, playgrounds and examples.
 */
export const Breadcrumb = ({ items }: { items: Crumb[] }) => (
  <nav className="docs-head__section crumbs" aria-label="Breadcrumb">
    {items.map((item, i) => (
      <span key={item.label} className="crumbs__item">
        {i > 0 && <span aria-hidden> · </span>}
        {item.href ? <a href={item.href}>{item.label}</a> : item.label}
      </span>
    ))}
  </nav>
);

// shadcn-style three columns: section sidebar, the page, and its contents.
export const DocsLayout = ({ route, toc, children }: { route: string; toc: TocItem[]; children: ReactNode }) => {
  const active = useActiveHeading(toc.map((t) => t.id));

  return (
    <div className="docs-layout container container--wide">
      <aside className="docs-sidebar" data-sidebar-scroll="page">
        <Sidebar route={route} />
      </aside>
      <div className="docs-main">
        <article className="docs-article" {...contentTarget}>{children}</article>
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
