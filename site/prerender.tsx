import { renderToString } from 'react-dom/server';
import { App, loadAllPages } from './App';
import { SettingsProvider } from './settings';

// In the browser each page is a chunk fetched when its route is opened (see
// App.tsx), and so are the chart library and a guide's live charts. Here they
// are all loaded before anything renders, so renderRoute is synchronous and
// its HTML is the whole page, never a loading state. The providers are the
// browser's (main.tsx), so the HTML is what the first client render draws.
await loadAllPages();

// The app for one route as an HTML string, for the static build. Load it with
// a DOM present (see withDom in agent-plugin.ts).
export const renderRoute = (route: string) =>
  renderToString(
    <SettingsProvider>
      <App route={route} />
    </SettingsProvider>,
  );
