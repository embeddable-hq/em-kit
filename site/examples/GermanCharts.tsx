import type { ReactNode } from 'react';
import { ChartsProvider } from '../../src';

const theme = {
  i18n: { language: 'de' }, // built-in text: 'en', 'de' or 'fr'
  formatter: { locale: 'de-DE' }, // numbers, currencies and dates
};

export function GermanCharts({ children }: { children: ReactNode }) {
  return (
    <ChartsProvider theme={theme} timezone="Europe/Berlin">
      {children}
    </ChartsProvider>
  );
}
