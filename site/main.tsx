import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { getEntry } from './catalog/registry';
import { BRAND } from './config';
import { getGuide } from './docs/guides';
import { ChartPage } from './pages/ChartPage';
import { ComponentDocPage } from './pages/ComponentDocPage';
import { ComponentsIndex } from './pages/ComponentsIndex';
import { DocPage } from './pages/DocPage';
import { Examples, isExampleId } from './pages/Examples';
import { Gallery } from './pages/Gallery';
import { Landing } from './pages/Landing';
import { useDocumentTitle, useRoute } from './router';
import { SiteSettingsProvider } from './state';
import './site.css';

const NotFound = () => {
  useDocumentTitle('Page not found', BRAND.name);
  return (
    <div className="container page">
      <h1>Page not found</h1>
      <p>
        <a href="/">Back to the home page</a> or <a href="/docs/components">browse the components</a>.
      </p>
    </div>
  );
};

const App = () => {
  const route = useRoute();
  const chartMatch = route.match(/^\/charts\/([\w-]+)(?:\/([\w-]+))?$/);
  const chartEntry = chartMatch ? getEntry(chartMatch[1]!) : undefined;
  const componentEntry = getEntry(route.match(/^\/docs\/components\/([\w-]+)$/)?.[1] ?? '');
  const guide = getGuide(route.match(/^\/docs\/([\w-]+)$/)?.[1] ?? '');
  const exampleId = route === '/examples' ? 'dashboard' : route.match(/^\/examples\/([\w-]+)$/)?.[1];

  let page;
  if (route === '/') page = <Landing />;
  else if (route === '/charts') page = <Gallery />;
  else if (route === '/docs/components') page = <ComponentsIndex route={route} />;
  else if (componentEntry) page = <ComponentDocPage key={route} entry={componentEntry} route={route} />;
  else if (guide) page = <DocPage key={route} guide={guide} route={route} />;
  else if (isExampleId(exampleId)) page = <Examples example={exampleId} />;
  else if (chartEntry) page = <ChartPage entry={chartEntry} variantId={chartMatch?.[2]} />;
  else page = <NotFound />;

  return <Layout route={route}>{page}</Layout>;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SiteSettingsProvider>
      <App />
    </SiteSettingsProvider>
  </StrictMode>,
);
