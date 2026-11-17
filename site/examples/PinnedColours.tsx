import type { ReactNode } from 'react';
import { ChartsProvider } from '../../src';

const theme = {
  charts: {
    backgroundColorMap: {
      // dimensionName.value
      dimensionValue: {
        'plan.Starter': '#fbbf24',
        'plan.Growth': '#d97706',
        'plan.Enterprise': '#92400e',
      },
      // measure name
      measure: { revenue: '#0b6e99' },
    },
  },
};

export function PinnedColours({ children }: { children: ReactNode }) {
  return <ChartsProvider theme={theme}>{children}</ChartsProvider>;
}
