import type { ReactNode } from 'react';
import { ChartsProvider, defaultTheme } from '../../src';
import type { ChartCardMenuOption } from '../../src';

const options = defaultTheme.defaults.chartMenuOptions.map((option): ChartCardMenuOption => {
  // PNG: a white background, and the whole card rather than the chart alone.
  if (option.value === 'png') {
    return { ...option, options: { pngBackgroundColor: '#ffffff', captureFullCard: true } };
  }
  // CSV: note the download, then run the built-in one.
  if (option.value === 'csv') {
    return {
      ...option,
      onClick: (args) => {
        console.info(`CSV downloaded: ${args.title}`);
        return option.onClick(args);
      },
    };
  }
  return option;
});

const theme = { defaults: { chartMenuOptions: options } };

export function CustomDownloads({ children }: { children: ReactNode }) {
  return <ChartsProvider theme={theme}>{children}</ChartsProvider>;
}
