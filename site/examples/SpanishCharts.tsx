import type { ReactNode } from 'react';
import { ChartsProvider } from '../../src';

const theme = {
  i18n: {
    language: 'es',
    translations: {
      es: {
        translation: {
          charts: {
            emptyTitle: 'Sin resultados.',
            emptyMessage: 'No hay datos para mostrar.',
            errorTitle: 'Algo ha fallado.',
            'menuOptions.downloadCSV': 'Descargar CSV',
          },
        },
      },
    },
  },
  formatter: { locale: 'es-ES' },
};

export function SpanishCharts({ children }: { children: ReactNode }) {
  return <ChartsProvider theme={theme}>{children}</ChartsProvider>;
}
