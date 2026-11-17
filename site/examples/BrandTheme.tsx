import type { ReactNode } from 'react';
import { ChartsProvider } from '../../src';

const theme = {
  styles: {
    '--em-sem-chart-color--1': '#0b6e99', // first series colour
    '--em-sem-chart-color--2': '#23a6d5', // second series colour
    '--em-sem-background': '#ffffff', // card background
    '--em-card-border-radius': '0.5rem', // one component's token
  },
};

export function BrandCharts({ children }: { children: ReactNode }) {
  return <ChartsProvider theme={theme}>{children}</ChartsProvider>;
}
