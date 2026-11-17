import { ResourceLanguage } from 'i18next';

// Strings this package adds to remarkable-pro's en and de bundles; fr.ts has
// the French. The keys are read by contentRewrites in scripts/sync.mjs: the
// card menu button's accessible name, and the label of a comparison series.
export const additions: Record<'en' | 'de', ResourceLanguage> = {
  en: {
    translation: {
      charts: {
        menuLabel: 'Chart menu: {{title}}',
        menuLabelUntitled: 'Chart menu',
        previousPeriodSeries: '{{label}} (previous period)',
      },
    },
  },
  de: {
    translation: {
      charts: {
        menuLabel: 'Diagrammmenü: {{title}}',
        menuLabelUntitled: 'Diagrammmenü',
        previousPeriodSeries: '{{label}} (Vorzeitraum)',
      },
    },
  },
};
