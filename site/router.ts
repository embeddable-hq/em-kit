import { useEffect, useState } from 'react';
import { canonicalPath } from './content/routes';

// Path-based routing (/docs/components/bar-chart), so every page has a real URL a
// search engine can index and a section can be linked as /docs/theming#dark.
// The host must serve index.html for unknown paths (Vite does in dev).

const ROUTE_EVENT = 'site:route';

const normalise = canonicalPath;

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

// The href of the same-origin <a href="/…"> an event happened in, when it is a route.
const routeHref = (event: Event) => {
  const anchor = (event.target as Element | null)?.closest?.('a');
  const raw = anchor?.getAttribute('href');
  if (!anchor || !raw || !raw.startsWith('/') || anchor.target || anchor.hasAttribute('download')) return undefined;
  // Files (/llms.txt, /docs/x.md) are real documents, not routes.
  if (/\.[a-z0-9]+$/i.test(raw.split(/[?#]/)[0]!)) return undefined;
  return raw;
};

// Same-origin <a href="/…"> clicks become client-side navigations.
const interceptLinks = (event: MouseEvent) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const raw = routeHref(event);
  if (!raw) return;
  event.preventDefault();
  const url = new URL(raw, window.location.origin);
  if (normalise(url.pathname) === currentPath() && url.hash) {
    window.history.pushState(null, '', url.pathname + url.hash);
    scrollToHashOrTop();
    return;
  }
  navigate(raw);
};

/** The route the page was opened on, with an old URL already replaced by its canonical one. */
export const initialRoute = () => {
  upgradeLegacyHash();
  return currentPath();
};

/**
 * What a route needs before it can be shown (its page's chunk). Undefined
 * when there is nothing to wait for.
 */
export type PrepareRoute = (route: string) => Promise<unknown> | undefined;

/**
 * The current route. With `prepare`, a navigation shows the new route once
 * its page is ready: until then the current page stays on screen, so there is
 * no blank or loading state in between. Links are also prepared on hover,
 * focus and touch, so the click usually finds the page already there.
 */
export const useRoute = (prepare?: PrepareRoute) => {
  const [route, setRoute] = useState(initialRoute);

  useEffect(() => {
    const onChange = () => {
      const next = currentPath();
      const pending = prepare?.(next);
      if (!pending) return setRoute(next);
      pending.then(
        // The URL as it is by now: a later click may have moved on.
        () => setRoute(currentPath()),
        // The chunk did not load (offline, or the site was redeployed): let
        // the browser load the page, which is a real file with its own HTML.
        () => currentPath() === next && window.location.reload(),
      );
    };
    const onIntent = (event: Event) => {
      const raw = routeHref(event);
      if (raw) prepare?.(normalise(new URL(raw, window.location.origin).pathname))?.catch(() => undefined);
    };
    window.addEventListener('popstate', onChange);
    window.addEventListener(ROUTE_EVENT, onChange);
    document.addEventListener('click', interceptLinks);
    document.addEventListener('pointerover', onIntent, { passive: true });
    document.addEventListener('focusin', onIntent);
    document.addEventListener('touchstart', onIntent, { passive: true });
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(ROUTE_EVENT, onChange);
      document.removeEventListener('click', interceptLinks);
      document.removeEventListener('pointerover', onIntent);
      document.removeEventListener('focusin', onIntent);
      document.removeEventListener('touchstart', onIntent);
    };
  }, [prepare]);

  // After a page change, land on the linked section, or the top.
  useEffect(() => {
    const frame = requestAnimationFrame(scrollToHashOrTop);
    return () => cancelAnimationFrame(frame);
  }, [route]);

  return route;
};

export const href = (path: string) => path;

// The landing page title: the site name and what it is, as in index.html.
const landingTitle = (siteName: string) => `${siteName} · React charts for your own data`;

export const useDocumentTitle = (title: string | undefined, siteName: string) => {
  useEffect(() => {
    document.title = title ? `${title} · ${siteName}` : landingTitle(siteName);
  }, [title, siteName]);
};
