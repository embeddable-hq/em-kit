import type { Scale } from 'chart.js';
import { useMemo } from 'react';
import {
  BarChartStackedPro,
  ChartsProvider,
  DonutChartPro,
  KpiChartNumberComparisonPro,
  KpiChartNumberPro,
  dimension,
  results,
} from '../../src';
import { datasets } from '../catalog/datasets';
import { buildTheme, getThemePreset, languages } from '../catalog/themes';
import { heroKey } from '../catalog/translations';
import { useSiteSettings } from '../state';
import { useLiveSeries } from './useLiveSeries';

const OPEN_RANGE = { from: undefined, to: undefined, relativeTimeString: undefined };

export const HeroDashboard = () => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const ds = datasets[datasetId];
  const preset = getThemePreset(themeId);
  const live = useLiveSeries(ds);

  // Scoped to the hero: stack colours from one hue, slimmer rounded bars.
  const theme = useMemo(() => {
    const base = buildTheme(themeId, languageId);
    const locale = languages.find((l) => l.id === languageId)?.locale ?? 'en-US';
    const hourFormat = new Intl.DateTimeFormat(locale, { hour: 'numeric' });
    const dimensionValue = Object.fromEntries(
      live.groups.map((g, i) => [`${ds.specs.group.name}.${g}`, preset.ramp[i % 3]!]),
    );
    return {
      ...base,
      charts: {
        backgroundColorMap: { dimensionValue },
        barChartStackedPro: {
          options: {
            datasets: { bar: { borderRadius: 3, barPercentage: 0.82, categoryPercentage: 0.92 } },
            animation: { duration: 350 },
            scales: {
              x: {
                ticks: {
                  maxRotation: 0,
                  autoSkip: true,
                  maxTicksLimit: 8,
                  // Hour only ("3 PM" / "15 Uhr") rather than the full date on every tick.
                  callback(this: Scale, value: string | number) {
                    const date = new Date(this.getLabelForValue(Number(value)));
                    return Number.isNaN(date.getTime()) ? '' : hourFormat.format(date);
                  },
                },
              },
            },
          },
        },
      },
    };
  }, [themeId, languageId, live.groups, preset, ds]);

  const time = useMemo(
    () => dimension({ name: ds.specs.time.name, title: 'Hour', type: 'time', granularity: 'hour' }),
    [ds],
  );
  const { primary, group } = ds;

  return (
    <ChartsProvider theme={theme}>
      <div className="hero-dash">
        <div className="hero-dash__kpi">
          <KpiChartNumberComparisonPro
            title={heroKey(ds, 'last24')}
            measure={primary}
            results={results([{ [primary.name]: live.last24 }])}
            resultsComparison={results([{ [primary.name]: live.previous24 }])}
            comparisonPeriod="Previous period"
            primaryDateRange={OPEN_RANGE}
            comparisonDateRange={OPEN_RANGE}
            displayChangeAsPercentage
          />
        </div>
        <div className="hero-dash__kpi">
          <KpiChartNumberPro
            title={heroKey(ds, 'thisHour')}
            measure={primary}
            results={results([{ [primary.name]: live.thisHour }])}
          />
        </div>
        <div className="hero-dash__kpi">
          <KpiChartNumberPro
            title={heroKey(ds, 'peak')}
            measure={primary}
            results={results([{ [primary.name]: live.peakHour }])}
          />
        </div>
        <div className="hero-dash__main">
          <BarChartStackedPro
            title={heroKey(ds, 'main')}
            description={heroKey(ds, 'mainDescription')}
            xAxis={time}
            groupBy={group}
            measure={primary}
            results={results(live.rows)}
            showLegend
            showTooltips
          />
        </div>
        <div className="hero-dash__side">
          <DonutChartPro
            title={heroKey(ds, 'share')}
            description={heroKey(ds, 'shareDescription')}
            dimension={group}
            measure={primary}
            results={results(live.byGroup)}
            showLegend
            showTooltips
          />
        </div>
      </div>
    </ChartsProvider>
  );
};
