import { type ReactElement, type ReactNode, Suspense, useState } from 'react';
import { type Chunk, chunk, useChunk, useChunkWhenReady } from './chunks';
import { contentTarget } from './components/DocsLayout';
import { Layout } from './components/Layout';
import { BRAND } from './config';
import { getGuide } from './content/guides';
import { getEntryBySlug } from './content/routes';
import type { ExampleId } from './pages/Examples';
import { fullMarkdown, guideChartDemos, guideChunks } from './pages/guideChunks';
import { useDocumentTitle } from './router';

// What every page loads is the app's frame: the header, the sidebar, search,
// the routes and the visitor's settings. Everything else is a chunk (see
// chunks.ts) that a route loads when it needs it:
// - each page is its own chunk;
// - a page that draws charts renders inside the charts' theme (charts.tsx),
//   which is a chunk too, so the chart library loads only on those pages;
// - a guide's live charts are a chunk its text does not wait for, and the
//   Markdown parser one only the guides whose prose needs it wait for;
// - the head tags load once the visitor moves to another page.

type PageComponent<P> = (props: P) => ReactNode;

/** A page in a chunk of its own. */
type LazyPage<P> = ((props: P) => ReactElement) & {
  chunk: Chunk<PageComponent<P>>;
  /** The page draws charts: it renders inside the charts' theme, which loads with it. */
  charts: boolean;
  /** More chunks, depending on the props: `now` before the page renders, `later` alongside it. */
  extras?: (props: P) => { now: Chunk<unknown>[]; later: Chunk<unknown>[] };
};

const lazyPage = <P extends object>(
  source: string,
  load: () => Promise<PageComponent<P>>,
  options: Omit<LazyPage<P>, 'chunk'>,
): LazyPage<P> => {
  const pageChunk = chunk(source, load);
  const Page = (props: P) => {
    const Component = useChunk(pageChunk);
    return <Component {...props} />;
  };
  return Object.assign(Page, { chunk: pageChunk, ...options });
};

const Landing = lazyPage('pages/Landing.tsx', () => import('./pages/Landing').then((m) => m.Landing), { charts: true });
const DocPage = lazyPage('pages/DocPage.tsx', () => import('./pages/DocPage').then((m) => m.DocPage), {
  charts: false,
  extras: ({ guide }) => guideChunks(guide),
});
const ComponentsIndex = lazyPage('pages/ComponentsIndex.tsx', () => import('./pages/ComponentsIndex').then((m) => m.ComponentsIndex), {
  charts: true,
});
const ComponentDocPage = lazyPage('pages/ComponentDocPage.tsx', () => import('./pages/ComponentDocPage').then((m) => m.ComponentDocPage), {
  charts: true,
});
const ChartPage = lazyPage('pages/ChartPage.tsx', () => import('./pages/ChartPage').then((m) => m.ChartPage), { charts: true });
const Examples = lazyPage('pages/Examples.tsx', () => import('./pages/Examples').then((m) => m.Examples), { charts: true });

const lazyPages: LazyPage<never>[] = [Landing, DocPage, ComponentsIndex, ComponentDocPage, ChartPage, Examples];

// The library's provider, with the visitor's theme and language.
const siteCharts = chunk('charts.tsx', () => import('./charts').then((m) => m.SiteChartsProvider));

const ChartsLayer = ({ children }: { children: ReactNode }) => {
  const SiteChartsProvider = useChunk(siteCharts);
  return <SiteChartsProvider>{children}</SiteChartsProvider>;
};

// The head tags (title, description, canonical URL, Markdown twin) of a route
// the visitor moved to. The module reads every page's title and builds its
// Markdown, so it is a chunk: the static HTML already has the tags of the page
// it was built for.
const headTags = chunk('head.ts', () =>
  import('./head').then(({ useHead }) => {
    const Head = ({ route }: { route: string }) => {
      useHead(route);
      return null;
    };
    return Head;
  }),
);

const RouteHead = ({ route }: { route: string }) => {
  const { value: Head } = useChunkWhenReady(headTags);
  return Head ? <Head route={route} /> : null;
};

// The route the document's head tags are for: its canonical URL's path. None
// in development (index.html has no canonical link) and on the not-found page.
const headRoute = () => {
  if (typeof document === 'undefined') return undefined;
  const href = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  return href ? new URL(href, window.location.origin).pathname : undefined;
};

// The ids pages/Examples.tsx knows, listed here so the route map does not
// import the page. A new example there is a type error here until it is added.
const exampleIds: Record<ExampleId, true> = { dashboard: true, 'ai-chat': true };
const isExampleId = (id: string | undefined): id is ExampleId => id !== undefined && Object.hasOwn(exampleIds, id);

const NotFound = () => {
  useDocumentTitle('Page not found', BRAND.name);
  return (
    <div className="container page" {...contentTarget}>
      <h1>Page not found</h1>
      <p>
        <a href="/">Back to the home page</a> or <a href="/docs/components">browse the components</a>.
      </p>
    </div>
  );
};

// The page for a route. `route` is already canonical (see content/routes.ts),
// so this is the whole map of the site:
//   /                                         landing
//   /docs/<guide>                             a guide
//   /docs/components                          every component, live
//   /docs/components/<slug>                   a component's docs
//   /docs/components/<slug>/playground[/<preset>]   its playground
//   /examples[/<id>]                          complete example apps
export const pageFor = (route: string): ReactElement => {
  if (route === '/') return <Landing />;
  if (route === '/docs/components') return <ComponentsIndex route={route} />;

  const component = route.match(/^\/docs\/components\/([\w-]+)(\/playground(?:\/([\w-]+))?)?$/);
  const entry = component ? getEntryBySlug(component[1]!) : undefined;
  if (entry && component?.[2]) return <ChartPage key={entry.id} entry={entry} variantId={component[3]} />;
  if (entry) return <ComponentDocPage key={route} entry={entry} route={route} />;

  const guide = getGuide(route.match(/^\/docs\/([\w-]+)$/)?.[1] ?? '');
  if (guide) return <DocPage key={route} guide={guide} route={route} />;

  const exampleId = route === '/examples' ? 'dashboard' : route.match(/^\/examples\/([\w-]+)$/)?.[1];
  if (isExampleId(exampleId)) return <Examples example={exampleId} />;

  return <NotFound />;
};

const lazyPageOf = (element: ReactElement) => lazyPages.find((page) => page === (element.type as unknown));

// The chunks a route's page needs: `now` before it renders, `later` alongside.
const chunksFor = (route: string): { now: Chunk<unknown>[]; later: Chunk<unknown>[] } => {
  const element = pageFor(route);
  const page = lazyPageOf(element);
  if (!page) return { now: [], later: [] };
  const extras = page.extras?.(element.props as never);
  return {
    now: [page.chunk, ...(page.charts ? [siteCharts] : []), ...(extras?.now ?? [])],
    later: extras?.later ?? [],
  };
};

const fetchAll = (chunks: Chunk<unknown>[]) => {
  const pending = chunks.map((c) => c.preload()).filter((p) => p !== undefined);
  return pending.length ? Promise.all(pending) : undefined;
};

/**
 * Fetches everything a route's page shows, its live charts included: what the
 * first render waits for (main.tsx), so it matches the static HTML. Undefined
 * when there is nothing to wait for: it is all here, or the route is the
 * not-found page.
 */
export const loadPage = (route: string) => {
  const { now, later } = chunksFor(route);
  return fetchAll([...now, ...later]);
};

/**
 * What a navigation waits for: what the page needs to draw (its chunk, the
 * charts' theme if it draws charts, the Markdown parser if its prose needs
 * it). A guide's live charts and the head tags are fetched at the same time
 * but not waited for, so a guide's text shows without waiting for the chart
 * library. The router also calls this on hover, focus and touch.
 */
export const preparePage = (route: string) => {
  const { now, later } = chunksFor(route);
  for (const extra of [...later, headTags]) extra.preload()?.catch(() => undefined);
  return fetchAll(now);
};

/** Every chunk a page can need, for rendering outside the browser (the static build and the tests). */
export const loadAllPages = () =>
  Promise.all([...lazyPages.map((page) => page.chunk), siteCharts, guideChartDemos, fullMarkdown].map((c) => c.preload()));

/** The module a route's page lives in, as the build manifest names it. */
export const pageSource = (route: string) => lazyPageOf(pageFor(route))?.chunk.source;

/** Every module the first render of a route needs (loadPage): what the static build preloads from its HTML. */
export const pageSources = (route: string) => {
  const { now, later } = chunksFor(route);
  return [...now, ...later].map((c) => c.source);
};

/** Whether a route's page draws charts, and so loads the chart library. */
export const pageDrawsCharts = (route: string) => {
  const { now, later } = chunksFor(route);
  return [...now, ...later].some((c) => c === siteCharts || c === guideChartDemos);
};

export const App = ({ route }: { route: string }) => {
  // Once the route is not the one the head tags were built for, the app keeps
  // them up to date, back on that route too.
  const [builtFor] = useState(headRoute);
  const [moved, setMoved] = useState(false);
  if (!moved && route !== builtFor) setMoved(true);
  const page = pageFor(route);
  return (
    <>
      <Layout route={route}>
        {/* A safety net: the router changes route only once the page's chunks are here (see useRoute). */}
        <Suspense
          fallback={
            <div className="container page" role="status">
              Loading…
            </div>
          }
        >
          {lazyPageOf(page)?.charts ? <ChartsLayer>{page}</ChartsLayer> : page}
        </Suspense>
      </Layout>
      {/* After the page's own effects (useDocumentTitle), with the same title. */}
      {moved && <RouteHead route={route} />}
    </>
  );
};
