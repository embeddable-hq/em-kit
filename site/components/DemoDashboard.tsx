import { useEffect, useMemo, useState } from 'react';
import {
  BarChartHorizontal,
  DonutChart,
  KpiNumberComparison,
  KpiNumber,
  LineChart,
  TablePaginated,
  measure,
  results,
} from '../../src';
import type { Granularity } from '../../src';
import { datasets, Row, WINDOWS } from '../catalog/datasets';
import type { TableState } from '../catalog/registry';
import { languages } from '../catalog/themes';
import { appKey } from '../catalog/translations';
import { useSiteSettings } from '../state';

const sum = (xs: number[]) => Math.round(xs.reduce((a, v) => a + v, 0));

const toRange = (window: { from: string; to: string }) => ({
  from: new Date(`${window.from}T00:00:00`),
  to: new Date(`${window.to}T00:00:00`),
  relativeTimeString: undefined,
});

const sortRows = (rows: Row[], sort: TableState['sort']) => {
  if (!sort) return rows;
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort.id];
    const bv = b[sort.id];
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av < bv ? -1 : av > bv ? 1 : 0) * factor;
  });
};

// The trend plots the last half-year: six month labels fit the card at every
// window width, where twelve would be tilted.
const TREND = WINDOWS.halfYear;

// A complete dashboard built only on the public API: five components, shared
// state for one filter, one granularity and the table page. The page shows the
// standalone version of this source; keep the two in step.
export const DemoDashboard = () => {
  const { datasetId, languageId } = useSiteSettings();
  const ds = datasets[datasetId];
  const { specs } = ds;
  const groupKey = specs.group.name;
  const categoryKey = specs.category.name;
  const primaryKey = specs.primary.name;
  const secondaryKey = specs.secondary.name;

  // Thousands and millions shortened on axes, labels and the year-to-date total; the table keeps full figures.
  const compactPrimary = useMemo(
    () =>
      measure({
        name: specs.primary.name,
        title: specs.primary.title,
        inputs: { ...specs.primary.inputs, abbreviateLargeNumber: true },
      }),
    [specs],
  );

  const trendPeriod = useMemo(() => {
    const locale = languages.find((l) => l.id === languageId)?.locale ?? 'en-US';
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).formatRange(
      new Date(`${TREND.from}T00:00:00`),
      new Date(`${TREND.to}T00:00:00`),
    );
  }, [languageId]);

  const [granularity, setGranularity] = useState<Granularity>('month');
  const [segment, setSegment] = useState<string | null>(null);
  const [tableState, setTableState] = useState<TableState>({ page: 0, isLoadingDownloadData: false });

  useEffect(() => setSegment(null), [ds.id]);
  useEffect(() => setTableState((s) => ({ ...s, page: 0 })), [ds.id, segment]);

  // In a real app each of these is a query; here they re-aggregate the sample
  // rows whenever the segment filter or granularity changes.
  const byGroup = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of ds.byCategoryGroup) {
      const g = String(r[groupKey]);
      totals.set(g, (totals.get(g) ?? 0) + Number(r[primaryKey] ?? 0));
    }
    return [...totals].map(([g, v]) => ({ [groupKey]: g, [primaryKey]: Math.round(v) }));
  }, [ds, groupKey, primaryKey]);

  // One row per category: the bar chart and the table read the same query.
  const categoryRows = useMemo(() => {
    const totals = new Map<string, [number, number]>();
    for (const r of ds.byCategoryGroup) {
      if (segment && r[groupKey] !== segment) continue;
      const c = String(r[categoryKey]);
      const [primary, secondary] = totals.get(c) ?? [0, 0];
      totals.set(c, [primary + Number(r[primaryKey] ?? 0), secondary + Number(r[secondaryKey] ?? 0)]);
    }
    return [...totals].map(([c, [primary, secondary]]) => ({
      [categoryKey]: c,
      [primaryKey]: Math.round(primary),
      [secondaryKey]: Math.round(secondary),
    }));
  }, [ds, segment, groupKey, categoryKey, primaryKey, secondaryKey]);

  const timeRows = useMemo(
    () =>
      segment
        ? ds.byTimeGroupWindow(granularity, TREND).filter((r) => r[groupKey] === segment)
        : ds.byTimeWindow(granularity, TREND),
    [ds, segment, granularity, groupKey],
  );

  // Each figure is a window's months summed as one query would sum them: the
  // last 30 days (June, 30 days) match the KPI cards on the components index,
  // and the year so far matches the months the trend plots.
  const windowTotal = (window: { from: string; to: string }) => {
    const months = segment
      ? ds.byTimeGroupWindow('month', window).filter((r) => r[groupKey] === segment)
      : ds.byTimeWindow('month', window);
    return sum(months.map((r) => Number(r[primaryKey] ?? 0)));
  };
  const last30 = windowTotal(WINDOWS.last30);
  const previous30 = windowTotal(WINDOWS.previous30);
  const yearToDate = windowTotal(TREND);
  const currentRange = toRange(WINDOWS.last30);
  const previousRange = toRange(WINDOWS.previous30);

  const tableSource = categoryRows;
  const pageSize = tableState.pageSize ?? 10;
  const pageRows = sortRows(tableSource, tableState.sort).slice(
    tableState.page * pageSize,
    (tableState.page + 1) * pageSize,
  );

  return (
    <div className="demo-app">
      <aside className="demo-app__side" aria-hidden="true">
        <span className="demo-app__logo" />
        <span className="demo-app__item is-active">Overview</span>
        <span className="demo-app__item">Reports</span>
        <span className="demo-app__item">Audiences</span>
        <span className="demo-app__item">Alerts</span>
        <span className="demo-app__item demo-app__item--last">Settings</span>
      </aside>
      <div className="demo-app__main">
        <div className="demo-app__topbar">
          <div>
            <span className="demo-app__title">Overview</span>
            <span className="demo-app__blurb">{ds.blurb}</span>
          </div>
          {/* How to filter is said once, on the donut's own card; this is the way back out. */}
          {segment && (
            <button type="button" className="demo-app__chip" onClick={() => setSegment(null)}>
              {ds.group.title}: {segment} <span aria-hidden>×</span>
            </button>
          )}
        </div>
        <div className="demo-app__grid">
          <div className="demo-app__cell demo-app__cell--kpi1">
            <KpiNumberComparison
              title={appKey(ds, 'last30')}
              measure={ds.primary}
              results={results([{ [primaryKey]: last30 }])}
              resultsComparison={results([{ [primaryKey]: previous30 }])}
              comparisonPeriod="Previous period"
              primaryDateRange={currentRange}
              comparisonDateRange={previousRange}
              displayChangeAsPercentage
            />
          </div>
          <div className="demo-app__cell demo-app__cell--kpi2">
            <KpiNumber
              title={appKey(ds, 'yearToDate')}
              measure={compactPrimary}
              results={results([{ [primaryKey]: yearToDate }])}
            />
          </div>
          <div className="demo-app__cell demo-app__cell--donut">
            <DonutChart
              title={appKey(ds, 'share')}
              description={appKey(ds, 'filterHint')}
              dimension={ds.group}
              measure={compactPrimary}
              results={results(byGroup)}
              showLegend
              showTooltips
              onSegmentClick={({ dimensionValue }) =>
                dimensionValue && setSegment((s) => (s === dimensionValue ? null : dimensionValue))
              }
            />
          </div>
          <div className="demo-app__cell demo-app__cell--line">
            <LineChart
              title={appKey(ds, 'trend')}
              description={trendPeriod}
              xAxis={ds.time(granularity)}
              measures={[compactPrimary]}
              results={results(timeRows)}
              granularity={granularity}
              setGranularity={setGranularity}
              showLegend={false}
              showValueLabels={false}
              showTooltips
            />
          </div>
          <div className="demo-app__cell demo-app__cell--bar">
            <BarChartHorizontal
              title={appKey(ds, 'byCategory')}
              dimension={ds.category}
              measures={[compactPrimary]}
              results={results(categoryRows)}
              showLegend={false}
              showTooltips
            />
          </div>
          <div className="demo-app__cell demo-app__cell--table">
            <TablePaginated
              title={appKey(ds, 'breakdown')}
              dimensionsAndMeasures={[ds.category, ds.primary, ds.secondary]}
              results={results(pageRows)}
              totalResults={{ isLoading: false, total: tableSource.length }}
              showIndex={false}
              state={tableState}
              setState={setTableState}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
