import type { ReactNode } from 'react';
import { ChartsProvider } from '../../src';

const dark = {
  styles: {
    '--em-sem-background': '#18181b',
    '--em-sem-background--light': '#27272a',
    '--em-sem-text': '#fafafa',
    '--em-sem-text--muted': '#a1a1aa',
    '--em-sem-text--subtle': '#52525b',
  },
};

const light = {}; // no overrides: the default theme

export function DarkModeCharts({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  return <ChartsProvider theme={isDark ? dark : light}>{children}</ChartsProvider>;
}
