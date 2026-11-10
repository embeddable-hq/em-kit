import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  DonutChart,
  KpiNumberComparison,
  KpiNumber,
  LineChart,
  TablePaginated,
  results,
} from '../../src';
import type { Granularity } from '../../src';
import { datasets, Row } from '../catalog/datasets';
import type { TableState } from '../catalog/registry';
import { appKey, chartTitleKey, heroKey } from '../catalog/translations';
import { useSiteSettings } from '../state';

const sum = (xs: number[]) => Math.round(xs.reduce((a, v) => a + v, 0));

const toRange = (days: [string, number][]) => ({
  from: days[0] ? new Date(days[0][0]) : undefined,
  to: days[days.length - 1] ? new Date(days[days.length - 1]![0]) : undefined,
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

// A complete dashboard built only on the public API: five components, shared
// state for one filter, one granularity and the table page. The page shows the
// standalone version of this source; keep the two in step.
export const DemoDashboard = () => {
  const { datasetId } = useSiteSettings();
  const ds = datasets[datasetId];
  const { specs } = ds;
  const groupKey = specs.group.name;
  const categoryKey = specs.category.name;
  const primaryKey = specs.primary.name;
  const timeKey = specs.time.name;

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

  const categoryRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of ds.byCategoryGroup) {
      if (segment && r[groupKey] !== segment) continue;
      const c = String(r[categoryKey]);
      totals.set(c, (totals.get(c) ?? 0) + Number(r[primaryKey] ?? 0));
    }
    return [...totals].map(([c, v]) => ({ [categoryKey]: c, [primaryKey]: Math.round(v) }));
  }, [ds, segment, groupKey, categoryKey, primaryKey]);

  const timeRows = useMemo(
    () => (segment ? ds.byTimeGroup(granularity).filter((r) => r[groupKey] === segment) : ds.byTime(granularity)),
    [ds, segment, granularity, groupKey],
  );

  const daily = useMemo(() => {
    const source = segment ? ds.byTimeGroup('day').filter((r) => r[groupKey] === segment) : ds.byTime('day');
    const perDay = new Map<string, number>();
    for (const r of source) {
      const day = String(r[timeKey]);
      perDay.set(day, (perDay.get(day) ?? 0) + Number(r[primaryKey] ?? 0));
    }
    return [...perDay.entries()];
  }, [ds, segment, groupKey, timeKey, primaryKey]);

  const dailyTotals = daily.map(([, v]) => v);
  const last30 = sum(dailyTotals.slice(-30));
  const previous30 = sum(dailyTotals.slice(-60, -30));
  const last12Months = sum(dailyTotals);
  const currentRange = toRange(daily.slice(-30));
  const previousRange = toRange(daily.slice(-60, -30));

  const tableSource = useMemo(
    () => (segment ? ds.byCategoryGroup.filter((r) => r[groupKey] === segment) : ds.byCategoryGroup),
    [ds, segment, groupKey],
  );
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
          {segment ? (
            <button type="button" className="demo-app__chip" onClick={() => setSegment(null)}>
              {ds.group.title}: {segment} <span aria-hidden>×</span>
            </button>
          ) : (
            <span className="demo-app__hint">Click a slice of the donut to filter</span>
          )}
        </div>
        <div className="demo-app__grid">
          <div className="demo-app__cell demo-app__cell--kpi1">
            <KpiNumberComparison
              title={chartTitleKey(ds, 'kpi', 'Last 30 days')}
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
              title={appKey(ds, 'last12')}
              measure={ds.primary}
              results={results([{ [primaryKey]: last12Months }])}
            />
          </div>
          <div className="demo-app__cell demo-app__cell--donut">
            <DonutChart
              title={heroKey(ds, 'share')}
              description={appKey(ds, 'filterHint')}
              dimension={ds.group}
              measure={ds.primary}
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
              title={chartTitleKey(ds, 'line', 'Trend')}
              xAxis={ds.time(granularity)}
              measures={[ds.primary]}
              results={results(timeRows)}
              granularity={granularity}
              setGranularity={setGranularity}
              showTooltips
            />
          </div>
          <div className="demo-app__cell demo-app__cell--bar">
            <BarChart
              title={chartTitleKey(ds, 'bar', 'By category')}
              dimension={ds.category}
              measures={[ds.primary]}
              results={results(categoryRows)}
              showTooltips
            />
          </div>
          <div className="demo-app__cell demo-app__cell--table">
            <TablePaginated
              title={chartTitleKey(ds, 'table', 'Breakdown')}
              dimensionsAndMeasures={[ds.category, ds.group, ds.primary, ds.secondary]}
              results={results(pageRows)}
              totalResults={{ isLoading: false, total: tableSource.length }}
              state={tableState}
              setState={setTableState}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
