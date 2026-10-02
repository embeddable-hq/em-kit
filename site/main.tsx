import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { getEntry } from './catalog/registry';
import { ChartPage } from './pages/ChartPage';
import { Docs } from './pages/Docs';
import { Gallery } from './pages/Gallery';
import { Landing } from './pages/Landing';
import { href, useRoute } from './router';
import { SiteSettingsProvider } from './state';
import './site.css';

const NotFound = () => (
  <div className="container page">
    <h1>Page not found</h1>
    <p>
      <a href={href('/')}>Back to the home page</a>
    </p>
  </div>
);

const App = () => {
  const route = useRoute();
  const chartMatch = route.match(/^\/charts\/([\w-]+)$/);
  const chartEntry = chartMatch ? getEntry(chartMatch[1]!) : undefined;

  let page;
  if (route === '/') page = <Landing />;
  else if (route === '/docs') page = <Docs />;
  else if (route === '/charts') page = <Gallery />;
  else if (chartEntry) page = <ChartPage entry={chartEntry} />;
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
