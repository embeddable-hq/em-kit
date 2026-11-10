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

export type ThemeId = 'default' | 'studio' | 'ocean' | 'forest' | 'midnight';

const palette = (colors: string[]) =>
  Object.fromEntries(colors.map((c, i) => [`--em-sem-chart-color--${i + 1}`, c]));

export const themePresets: ThemePreset[] = [
  {
    // Restrained, dashboard-style defaults: Midnight's violet and pink, a shade
    // deeper for a light background, with a faint grid, muted axis labels,
    // rounder bars and a hairline card border.
    id: 'studio',
    label: 'Studio',
    swatches: ['#8b5cf6', '#ec4899', '#38bdf8', '#f59e0b'],
    canvas: '#ffffff',
    ramp: ['#c4b5fd', '#8b5cf6', '#5b21b6'],
    styles: {
      ...palette(['#8b5cf6', '#ec4899', '#38bdf8', '#f59e0b', '#10b981', '#6366f1', '#d946ef', '#14b8a6', '#fb7185', '#a1a1aa']),
      '--em-sem-background': '#ffffff',
      '--em-card-border-radius': '0.75rem',
      '--em-card-border-width': '0.0625rem',
      '--em-card-border-color': '#e4e4e7',
      '--em-card-title-font-weight': '600',
      '--em-barchart-border-radius': '0.5rem',
      '--em-chart-grid-line-color--light': '#f4f4f5',
      '--em-chart-grid-label-color': '#71717a',
      '--em-chart-grid-label-color--muted': '#a1a1aa',
    },
  },
  {
    id: 'default',
    // The library's own look, with no overrides.
    label: 'Classic',
    swatches: ['#ff5400', '#3a86ff', '#f99f2e', '#ee476f'],
    canvas: '#ffffff',
    ramp: ['#ffa066', '#ff5400', '#a33600'],
    styles: {},
  },
  {
    id: 'ocean',
    label: 'Ocean',
    swatches: ['#0b6e99', '#23a6d5', '#5fd3c6', '#1d3557'],
    canvas: '#ffffff',
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

// Applied under every preset: the KPI number auto-sizes to its box, which in
// a tall card means very large, so cap it at a headline size.
const sharedStyles: Record<string, string> = {
  '--em-kpichart-number-font-size--max': '3.5rem',
};

export const themeStyles = (preset: ThemePreset) => ({ ...sharedStyles, ...preset.styles });

// The theme the site opens with.
export const DEFAULT_THEME_ID: ThemeId = 'studio';

export const buildTheme = (themeId: ThemeId, languageId: LanguageId): ThemeOverride => {
  const preset = getThemePreset(themeId);
  const language = languages.find((l) => l.id === languageId) ?? languages[0]!;
  return {
    styles: themeStyles(preset),
    i18n: { language: language.id, translations: contentTranslations },
    formatter: { locale: language.locale },
  } as ThemeOverride;
};
