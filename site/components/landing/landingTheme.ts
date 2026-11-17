import { useMemo } from 'react';
import { buildTheme } from '../../catalog/themes';
import { useSiteSettings } from '../../state';

// Axis labels stay level in a small card: skip ticks rather than rotate them.
const levelTicks = { ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 16 } };
const fewLevelTicks = { ticks: { maxRotation: 0, maxTicksLimit: 4, autoSkip: true, autoSkipPadding: 14 } };

// The site's chart theme with level axis labels, for the landing page's
// previews. They are smaller than a dashboard card, where the library's
// default (tilt the labels to fit them all) is the better choice.
export const useLandingTheme = () => {
  const { themeId, languageId } = useSiteSettings();
  return useMemo(
    () => ({
      ...buildTheme(themeId, languageId),
      charts: {
        barChartDefaultPro: { options: { scales: { x: { ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 4 } } } } },
        barChartDefaultHorizontalPro: { options: { scales: { x: fewLevelTicks } } },
        // The stacked area chart builds on the grouped line chart's options.
        lineChartGroupedPro: { options: { scales: { x: levelTicks } } },
        scatterChartPro: { options: { scales: { x: fewLevelTicks } } },
      },
    }),
    [themeId, languageId],
  );
};
