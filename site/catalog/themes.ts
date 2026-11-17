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

export type ThemeId = 'default' | 'cool' | 'mono' | 'uluru';

const palette = (colors: string[]) =>
  Object.fromEntries(colors.map((c, i) => [`--em-sem-chart-color--${i + 1}`, c]));

// The four colour themes are those of the "Style your charts" panel on
// embeddable.com: Default, Cool, Mono and Uluru. Default, Cool and Mono are a
// palette on the package's white card (embeddable.com shows five colours a
// palette; their six to ten here are deeper or lighter versions of those).
// Uluru is a dark theme there, so it is one here: its values are the ones
// that panel sets, all ten colours included.
export const themePresets: ThemePreset[] = [
  {
    // The package's own look (src/theme.ts) and upstream's colours, with no
    // overrides: what a reader gets from the code on any page without a theme.
    id: 'default',
    label: 'Default',
    swatches: ['#ff5400', '#3a86ff', '#ff8a00', '#ff2f6d'],
    canvas: '#ffffff',
    ramp: ['#ffa066', '#ff5400', '#a33600'],
    styles: {},
  },
  {
    id: 'cool',
    label: 'Cool',
    swatches: ['#5f68d9', '#789be1', '#5e66cf', '#2891cd'],
    canvas: '#ffffff',
    ramp: ['#a7acea', '#5f68d9', '#343b8f'],
    styles: palette(['#5f68d9', '#789be1', '#5e66cf', '#2891cd', '#6473d2', '#424998', '#546c9e', '#a7acea', '#1c6690', '#b5c8ef']),
  },
  {
    id: 'mono',
    label: 'Mono',
    swatches: ['#6c6c6c', '#a0a0a0', '#787878', '#9b9b9b'],
    canvas: '#ffffff',
    ramp: ['#b4b4b4', '#6c6c6c', '#2e2e2e'],
    styles: palette(['#6c6c6c', '#a0a0a0', '#787878', '#9b9b9b', '#b4b4b4', '#4a4a4a', '#c8c8c8', '#5a5a5a', '#8c8c8c', '#d7d7d7']),
  },
  {
    id: 'uluru',
    label: 'Uluru',
    swatches: ['#f67257', '#f5cd92', '#fab1a3', '#fae4c3'],
    canvas: '#17191c',
    dark: true,
    ramp: ['#fab1a3', '#f67257', '#a04a39'],
    styles: {
      ...palette(['#f67257', '#f5cd92', '#fab1a3', '#fae4c3', '#a04a39', '#9f855f', '#fcf0de', '#f89581', '#9c4837', '#6e5c42']),
      '--em-sem-background': '#030508',
      '--em-sem-background--inverted': '#ffffff',
      '--em-sem-background--light': '#17191c',
      '--em-sem-background--muted': '#643128',
      '--em-sem-background--neutral': '#020406',
      '--em-sem-background--subtle': '#26282b',
      '--em-sem-text': '#ffffff',
      '--em-sem-text--inverted': '#212129',
      '--em-sem-text--muted': '#b3b4b5',
      '--em-sem-text--neutral': '#ffffff',
      '--em-sem-text--subtle': '#747677',
      '--em-sem-status-error-text': '#ff8686',
      '--em-sem-status-error-background': '#501616',
      '--em-sem-status-success-text': '#6ee3aa',
      '--em-sem-status-success-background': '#103225',
      '--em-kpichart-color': '#ffffff',
      '--em-card-title-color': 'var(--em-sem-text)',
      '--em-card-subtitle-color': 'var(--em-sem-text--muted)',
      '--em-core-shadow-color': '#00000080',
      '--em-selectfield-content-background': '#212129',
      '--em-selectfield-content-shadow-color': '#00000080',
      '--em-selectfield-item-background': '#212129',
      '--em-selectfield-item-background--hover': '#2e2e39',
      '--em-switch-shadow-color': '#21212940',
      '--em-tablechart-cell-background': '#1a1a21',
      '--em-tablechart-header-background': '#1a1a21',
      '--em-divider-color': '#ffffff',
      '--em-filter-background--operator': '#212129',
      '--em-filter-border-color--selected': '#ffffff1a',
      '--em-charttabs-item-border-color--active': '#ededf1',
      '--em-charttabs-item-border-color': '#5c5c66',
      // The package's own defaults (src/theme.ts) are picked for a white card:
      // its hairline border, grid lines and axis labels, restated for a dark one.
      '--em-card-border-color': '#26282b',
      '--em-chart-grid-line-color--light': '#26282b',
      '--em-chart-grid-label-color': '#b3b4b5',
      '--em-chart-grid-label-color--muted': '#b3b4b5',
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

// The theme the site opens with.
export const DEFAULT_THEME_ID: ThemeId = 'default';

export const buildTheme = (themeId: ThemeId, languageId: LanguageId): ThemeOverride => {
  const preset = getThemePreset(themeId);
  const language = languages.find((l) => l.id === languageId) ?? languages[0]!;
  return {
    styles: preset.styles,
    i18n: { language: language.id, translations: contentTranslations },
    formatter: { locale: language.locale },
  } as ThemeOverride;
};
