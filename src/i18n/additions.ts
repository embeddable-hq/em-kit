import { ResourceLanguage } from 'i18next';

// Strings this package adds to remarkable-pro's en and de bundles; fr.ts has
// the French. The keys are read by contentRewrites in scripts/sync.mjs: the
// card menu button's accessible name, and the label of a comparison series.
// `controls.placeholder` translates the controls' default placeholders
// (scripts/exports.mjs makes each a "key|fallback" string); English is the fallback.
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
      controls: {
        placeholder: {
          dateRangePicker: 'Zeitraum auswählen',
          dateRangePickerCustom: 'Zeitraum auswählen',
          granularitySelect: 'Granularität auswählen',
          comparisonPeriodSelect: 'Vergleich auswählen',
          singleSelect: 'Wert auswählen…',
          multiSelect: 'Werte auswählen…',
        },
      },
    },
  },
};
