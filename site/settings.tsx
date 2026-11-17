import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { datasets } from './catalog/datasets';
import type { DatasetId } from './catalog/datasets';
import { DEFAULT_THEME_ID, getThemePreset, LanguageId, languages, themePresets, ThemeId } from './catalog/themes';

// The visitor's theme, language and dataset: plain state every page has. It
// does not import the chart library, so a page without charts does not load
// it. The charts' theme is built from these in charts.tsx, on the pages that
// draw charts (see App.tsx).

type SiteSettings = {
  themeId: ThemeId;
  languageId: LanguageId;
  datasetId: DatasetId;
  setThemeId: (id: ThemeId) => void;
  setLanguageId: (id: LanguageId) => void;
  setDatasetId: (id: DatasetId) => void;
};

const SettingsContext = createContext<SiteSettings | null>(null);

// Charts draw their text on a canvas, which cannot wait for a web font the way
// HTML text does. The library asks for Inter only once its provider has
// mounted, after the first charts have drawn. So the site asks as this module
// loads: the stylesheet first, then the font files themselves rather than
// waiting for some text to need them. The charts listen for the fonts and
// redraw when they arrive; until then they use the fallbacks in the package's
// font stack (src/theme.ts). The site's own text is set in Inter too.
const FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap';
const FONT_WEIGHTS = ['400', '500', '600', '700'];

const requestChartFonts = () => {
  if (typeof document === 'undefined' || !document.head) return;
  // The attributes are the library's own markers, so it does not add the same links again.
  if (document.querySelector('link[data-remarkable-google-fonts]')) return;
  for (const [href, crossOrigin] of [
    ['https://fonts.googleapis.com', false],
    ['https://fonts.gstatic.com', true],
  ] as const) {
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = href;
    if (crossOrigin) preconnect.crossOrigin = 'anonymous';
    preconnect.setAttribute('data-remarkable-preconnect', '1');
    document.head.appendChild(preconnect);
  }
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = FONT_STYLESHEET;
  stylesheet.setAttribute('data-remarkable-google-fonts', '1');
  stylesheet.addEventListener('load', () => {
    for (const weight of FONT_WEIGHTS) void document.fonts?.load(`${weight} 12px Inter`).catch(() => undefined);
  });
  document.head.appendChild(stylesheet);
};

requestChartFonts();

// The theme and the data set a visitor chose are remembered between visits.
// The language is kept only for the browser session: the docs are written in
// English, so a new visit opens in English, whatever was tried last time.
export const SETTINGS_STORAGE_KEY = 'rkit-site-settings';
export const LANGUAGE_STORAGE_KEY = 'rkit-site-language';

const read = (storage: () => Storage, key: string): Record<string, unknown> => {
  try {
    return JSON.parse(storage().getItem(key) ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
};

// Keeps only values the site still offers: a stale or hand-edited entry falls
// back to the default instead of breaking every chart.
const readStored = (): Partial<Pick<SiteSettings, 'themeId' | 'languageId' | 'datasetId'>> => {
  const stored = read(() => localStorage, SETTINGS_STORAGE_KEY);
  const session = read(() => sessionStorage, LANGUAGE_STORAGE_KEY);
  return {
    themeId: themePresets.find((t) => t.id === stored.themeId)?.id,
    languageId: languages.find((l) => l.id === session.languageId)?.id,
    datasetId: typeof stored.datasetId === 'string' && stored.datasetId in datasets ? (stored.datasetId as DatasetId) : undefined,
  };
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const stored = useMemo(readStored, []);
  const [themeId, setThemeId] = useState<ThemeId>(stored.themeId ?? DEFAULT_THEME_ID);
  const [languageId, setLanguageId] = useState<LanguageId>(stored.languageId ?? 'en');
  const [datasetId, setDatasetId] = useState<DatasetId>(stored.datasetId ?? 'saas');

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ themeId, datasetId }));
      sessionStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify({ languageId }));
    } catch {
      // Storage unavailable; settings just won't persist.
    }
  }, [themeId, languageId, datasetId]);

  const value = useMemo(
    () => ({ themeId, languageId, datasetId, setThemeId, setLanguageId, setDatasetId }),
    [themeId, languageId, datasetId],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSiteSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSiteSettings must be used inside SettingsProvider');
  return ctx;
};

export const useCanvas = () => {
  const { themeId } = useSiteSettings();
  const preset = getThemePreset(themeId);
  return { background: preset.canvas, dark: Boolean(preset.dark) };
};
