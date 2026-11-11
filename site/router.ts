import { useEffect, useState } from 'react';

// Path-based routing (/docs/components/bar), so every page has a real URL a
// search engine can index and a section can be linked as /docs/theming#dark.
// The host must serve index.html for unknown paths (Vite does in dev).

// Routes from earlier versions of the site, so old links keep working.
const ALIASES: Record<string, string> = {
  '/sample-app': '/examples',
  '/ai': '/examples/ai-chat',
  '/docs': '/docs/introduction',
};

const ROUTE_EVENT = 'site:route';

const normalise = (path: string) => {
  const trimmed = path.replace(/\/+$/, '') || '/';
  return ALIASES[trimmed] ?? trimmed;
};

// Hash routes from before (#/charts/bar) become real paths, and aliases their
// canonical path, once, on load: one URL per page.
const upgradeLegacyHash = () => {
  const { hash, pathname } = window.location;
  if (hash.startsWith('#/')) window.history.replaceState(null, '', normalise(hash.slice(1)));
  else if (normalise(pathname) !== pathname) window.history.replaceState(null, '', normalise(pathname) + hash);
};

const currentPath = () => normalise(window.location.pathname);

const scrollToHashOrTop = () => {
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if (target) target.scrollIntoView({ block: 'start' });
  else window.scrollTo({ top: 0 });
};

export const navigate = (to: string, { replace = false }: { replace?: boolean } = {}) => {
  const url = new URL(to, window.location.origin);
  const path = normalise(url.pathname) + url.hash;
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
};

// Same-origin <a href="/…"> clicks become client-side navigations.
const interceptLinks = (event: MouseEvent) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const anchor = (event.target as Element | null)?.closest?.('a');
  const raw = anchor?.getAttribute('href');
  if (!anchor || !raw || !raw.startsWith('/') || anchor.target || anchor.hasAttribute('download')) return;
  event.preventDefault();
  const url = new URL(raw, window.location.origin);
  if (normalise(url.pathname) === currentPath() && url.hash) {
    window.history.pushState(null, '', url.pathname + url.hash);
    scrollToHashOrTop();
    return;
  }
  navigate(raw);
};

export const useRoute = () => {
  const [route, setRoute] = useState(() => {
    upgradeLegacyHash();
    return currentPath();
  });

  useEffect(() => {
    const onChange = () => setRoute(currentPath());
    window.addEventListener('popstate', onChange);
    window.addEventListener(ROUTE_EVENT, onChange);
    document.addEventListener('click', interceptLinks);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(ROUTE_EVENT, onChange);
      document.removeEventListener('click', interceptLinks);
    };
  }, []);

  // After a page change, land on the linked section, or the top.
  useEffect(() => {
    const frame = requestAnimationFrame(scrollToHashOrTop);
    return () => cancelAnimationFrame(frame);
  }, [route]);

  return route;
};

export const href = (path: string) => path;

export const useDocumentTitle = (title: string | undefined, siteName: string) => {
  useEffect(() => {
    document.title = title ? `${title} · ${siteName}` : siteName;
  }, [title, siteName]);
};
