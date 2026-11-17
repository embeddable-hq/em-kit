import type { Scale } from 'chart.js';
import { useMemo } from 'react';
import { BarChartStacked, ChartsProvider, KpiNumber, KpiNumberComparison, dimension, results } from '../../src';
import { datasets } from '../catalog/datasets';
import { buildTheme, getThemePreset, languages } from '../catalog/themes';
import { heroKey } from '../catalog/translations';
import { useCanvas, useSiteSettings } from '../state';
import { useLiveSeries } from './useLiveSeries';

const OPEN_RANGE = { from: undefined, to: undefined, relativeTimeString: undefined };

// The hero's one visual: three components in a small dashboard, fed by a
// series that keeps updating, so the first thing a visitor sees is live and
// can be hovered. It follows the theme, language and dataset switcher.
export const HeroShowcase = () => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const canvas = useCanvas();
  const ds = datasets[datasetId];
  const preset = getThemePreset(themeId);
  const live = useLiveSeries(ds);
  const { primary, group } = ds;

  // Scoped to the hero: stack colours from one hue, slimmer rounded bars and
  // hour-only ticks ("3 PM" / "15 Uhr") so 48 bars fit without rotated labels.
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

  return (
    <ChartsProvider theme={theme}>
      <div className={`app-window lp-window${canvas.dark ? ' is-dark' : ''}`}>
        <div className="app-window__bar">
          <span className="app-window__dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <span className="app-window__title">your-app.com · {ds.label.toLowerCase()}</span>
          <span className="app-window__live">
            <span className="app-window__pulse" aria-hidden />
            live
          </span>
        </div>
        <div className="app-window__canvas lp-dash" style={{ background: canvas.background }}>
          <div className="lp-dash__kpi">
            <KpiNumberComparison
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
          <div className="lp-dash__kpi">
            <KpiNumber
              title={heroKey(ds, 'thisHour')}
              measure={primary}
              results={results([{ [primary.name]: live.thisHour }])}
            />
          </div>
          <div className="lp-dash__main">
            <BarChartStacked
              title={heroKey(ds, 'main')}
              xAxis={time}
              groupBy={group}
              measure={primary}
              results={results(live.rows)}
              showLegend
              showTooltips
            />
          </div>
        </div>
      </div>
    </ChartsProvider>
  );
};
