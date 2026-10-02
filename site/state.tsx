import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { ChartsProvider } from '../src';
import type { DatasetId } from './catalog/datasets';
import { buildTheme, getThemePreset, LanguageId, ThemeId } from './catalog/themes';

type SiteSettings = {
  themeId: ThemeId;
  languageId: LanguageId;
  datasetId: DatasetId;
  setThemeId: (id: ThemeId) => void;
  setLanguageId: (id: LanguageId) => void;
  setDatasetId: (id: DatasetId) => void;
};

const SettingsContext = createContext<SiteSettings | null>(null);

const STORAGE_KEY = 'charts-ui-site-settings-v2';

const readStored = (): Partial<Pick<SiteSettings, 'themeId' | 'languageId' | 'datasetId'>> => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
};

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const stored = useMemo(readStored, []);
  const [themeId, setThemeId] = useState<ThemeId>(stored.themeId ?? 'midnight');
  const [languageId, setLanguageId] = useState<LanguageId>(stored.languageId ?? 'en');
  const [datasetId, setDatasetId] = useState<DatasetId>(stored.datasetId ?? 'saas');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeId, languageId, datasetId }));
    } catch {
      // Storage unavailable; settings just won't persist.
    }
  }, [themeId, languageId, datasetId]);

  const theme = useMemo(() => buildTheme(themeId, languageId), [themeId, languageId]);
  const value = useMemo(
    () => ({ themeId, languageId, datasetId, setThemeId, setLanguageId, setDatasetId }),
    [themeId, languageId, datasetId],
  );

  return (
    <SettingsContext.Provider value={value}>
      <ChartsProvider theme={theme}>{children}</ChartsProvider>
    </SettingsContext.Provider>
  );
};

export const useSiteSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSiteSettings must be used inside SiteSettingsProvider');
  return ctx;
};

export const useCanvas = () => {
  const { themeId } = useSiteSettings();
  const preset = getThemePreset(themeId);
  return { background: preset.canvas, dark: Boolean(preset.dark) };
};
