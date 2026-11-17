import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, loadPage, preparePage } from './App';
import { initialRoute, useRoute } from './router';
import { SettingsProvider } from './settings';
import './site.css';
import './styles/nav.css';
import './styles/landing.css';
import './styles/docs.css';
import './styles/components.css';
import './styles/charts.css';
import './styles/chrome.css';
import './styles/code.css';

const Root = () => <App route={useRoute(preparePage)} />;

const mount = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SettingsProvider>
        <Root />
      </SettingsProvider>
    </StrictMode>,
  );

// Each page is its own chunk (see App.tsx), and so are the chart library and a
// guide's live charts. The static build's HTML stays on screen until the
// chunks this page shows are here (its HTML preloads them), so the first
// render replaces it with the same content rather than a loading state. If a
// chunk cannot be fetched, the HTML is left as it is: readable, with links
// that still work.
const page = loadPage(initialRoute());
if (page) page.then(mount, (error) => console.error(error));
else mount();
