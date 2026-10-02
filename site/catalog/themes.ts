import type { ChartsProviderProps } from '../../src';
import { datasetList } from './datasets';
import { siteTranslations } from './translations';

type ThemeOverride = NonNullable<ChartsProviderProps['theme']>;

export type ThemePreset = {
  id: ThemeId;
  label: string;
  swatches: string[];
  canvas: string;
  dark?: boolean;
  // Single-hue shades, bright to deep, for stacked series in the hero dashboard.
  ramp: [string, string, string];
  styles: Record<string, string>;
};

export type ThemeId = 'default' | 'ocean' | 'forest' | 'midnight';

const palette = (colors: string[]) =>
  Object.fromEntries(colors.map((c, i) => [`--em-sem-chart-color--${i + 1}`, c]));

export const themePresets: ThemePreset[] = [
  {
    id: 'default',
    label: 'Default',
    swatches: ['#ff5400', '#3a86ff', '#f99f2e', '#ee476f'],
    canvas: '#ffffff',
    ramp: ['#ffa066', '#ff5400', '#a33600'],
    styles: {},
  },
  {
    id: 'ocean',
    label: 'Ocean',
    swatches: ['#0b6e99', '#23a6d5', '#5fd3c6', '#1d3557'],
    canvas: '#f4f8fb',
    ramp: ['#48cae4', '#0096c7', '#023e8a'],
    styles: {
      ...palette(['#0b6e99', '#23a6d5', '#5fd3c6', '#1d3557', '#8ecae6', '#219ebc', '#023047', '#48cae4', '#90e0ef', '#0077b6']),
      '--em-sem-background': '#ffffff',
      '--em-card-border-radius': '0.5rem',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    swatches: ['#2d6a4f', '#95b46a', '#d4a373', '#6c584c'],
    canvas: '#f6f5ef',
    ramp: ['#95d5b2', '#52b788', '#1b4332'],
    styles: {
      ...palette(['#2d6a4f', '#95b46a', '#d4a373', '#6c584c', '#52b788', '#bc6c25', '#40916c', '#dda15e', '#1b4332', '#a98467']),
      '--em-sem-background': '#fffdf7',
      '--em-card-border-radius': '0.25rem',
      '--em-card-border-width': '0.0625rem',
      '--em-card-border-color': '#e6e2d3',
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    swatches: ['#a78bfa', '#38bdf8', '#f472b6', '#facc15'],
    canvas: '#09090b',
    ramp: ['#fbbf24', '#d97706', '#92400e'],
    dark: true,
    styles: {
      ...palette(['#a78bfa', '#38bdf8', '#f472b6', '#facc15', '#34d399', '#fb923c', '#818cf8', '#2dd4bf', '#f87171', '#e879f9']),
      '--em-sem-background': '#18181b',
      '--em-sem-background--light': '#27272a',
      '--em-sem-background--subtle': '#27272a',
      '--em-sem-background--muted': '#3f3f46',
      '--em-sem-background--neutral': '#09090b',
      '--em-sem-background--inverted': '#fafafa',
      '--em-sem-text': '#fafafa',
      '--em-sem-text--neutral': '#ffffff',
      '--em-sem-text--muted': '#a1a1aa',
      '--em-sem-text--subtle': '#52525b',
      '--em-sem-text--inverted': '#09090b',
      '--em-sem-status-success-background': 'rgb(52 211 153 / 15%)',
      '--em-sem-status-success-text': '#34d399',
      '--em-sem-status-error-background': 'rgb(248 113 113 / 15%)',
      '--em-sem-status-error-text': '#f87171',
    },
  },
];

export type LanguageId = 'en' | 'de' | 'fr';

export const languages: { id: LanguageId; label: string; locale: string }[] = [
  { id: 'en', label: 'English', locale: 'en-US' },
  { id: 'de', label: 'Deutsch', locale: 'de-DE' },
  { id: 'fr', label: 'Français', locale: 'fr-FR' },
];

// Titles, field names and values used by the site's sample charts.
const contentTranslations = siteTranslations(datasetList);

export const getThemePreset = (id: ThemeId) => themePresets.find((t) => t.id === id) ?? themePresets[0]!;

export const buildTheme = (themeId: ThemeId, languageId: LanguageId): ThemeOverride => {
  const preset = getThemePreset(themeId);
  const language = languages.find((l) => l.id === languageId) ?? languages[0]!;
  return {
    styles: preset.styles,
    i18n: { language: language.id, translations: contentTranslations },
    formatter: { locale: language.locale },
  } as ThemeOverride;
};
