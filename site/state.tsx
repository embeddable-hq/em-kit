import type { ReactNode } from 'react';
import { SiteChartsProvider } from './charts';
import { SettingsProvider } from './settings';

// The site's settings, for code that draws charts. This module imports the
// chart library (through charts.tsx), so modules on pages without charts
// import the same hooks from ./settings instead.
export { useCanvas, useSiteSettings } from './settings';

/**
 * The settings and the charts' theme together, for rendering a page that
 * draws charts on its own, outside the app (the tests). The app renders
 * SettingsProvider around every page and adds the charts' theme only on the
 * pages that draw charts (App.tsx).
 */
export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <SiteChartsProvider>{children}</SiteChartsProvider>
  </SettingsProvider>
);
