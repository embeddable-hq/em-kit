import type { ReactNode } from 'react';
import { ChartsProvider } from '../../src';

// Chart.js options for one chart type, merged over the defaults.
const noAnimation = { options: { animation: false as const } };

const still = {
  charts: {
    barChartDefaultPro: noAnimation,
    lineChartDefaultPro: noAnimation,
    pieChartPro: noAnimation,
  },
};
const animated = {}; // no overrides: the default theme

export function StillCharts({ children }: { children: ReactNode }) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return <ChartsProvider theme={reduceMotion ? still : animated}>{children}</ChartsProvider>;
}
