import { ReactNode, useMemo } from 'react';
import { ChartsProvider } from '../src';
import { buildTheme } from './catalog/themes';
import { useSiteSettings } from './settings';

// The library's provider with the theme and language the visitor picked.
// Only pages that draw charts load this module, and the library with it: the
// app renders it around those pages (App.tsx) and around each live chart in
// a guide (pages/guideChartDemos.tsx). A new choice in the switchers re-renders
// it, and every chart under it follows.
export const SiteChartsProvider = ({ children }: { children: ReactNode }) => {
  const { themeId, languageId } = useSiteSettings();
  const theme = useMemo(() => buildTheme(themeId, languageId), [themeId, languageId]);
  return <ChartsProvider theme={theme}>{children}</ChartsProvider>;
};
