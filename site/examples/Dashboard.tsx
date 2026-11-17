import { useMemo, useState } from 'react';
import {
  BarChartHorizontal,
  ChartsProvider,
  DonutChart,
  KpiNumber,
  KpiNumberComparison,
  LineChart,
  TablePaginated,
  dimension,
  measure,
  results,
} from '../../src';
import type { Granularity, TablePaginatedProps } from '../../src';

const region = dimension({ name: 'region', title: 'Region' });
const plan = dimension({ name: 'plan', title: 'Plan' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });
const customers = measure({ name: 'customers', title: 'Customers' });
// The same measure with thousands and millions shortened, for axes and labels.
const revenueCompact = measure({
  name: 'revenue',
  title: 'Revenue',
  inputs: { prefix: '$', abbreviateLargeNumber: true },
});

// ---- A stand-in for your data layer: daily sales for January to June 2026.
// Replace `sales` and the queries in Dashboard with calls to your own API.

type Sale = { day: Date; region: string; plan: string; revenue: number; customers: number };
type Row = Record<string, string | number>;

const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
const plans = ['Starter', 'Growth', 'Enterprise'];
const days = Array.from({ length: 181 }, (_, d) => new Date(2026, 0, 1 + d));
const sales: Sale[] = days.flatMap((day, d) =>
  regions.flatMap((regionName, r) =>
    plans.map((planName, p) => ({
      day,
      region: regionName,
      plan: planName,
      revenue: Math.round((200 - r * 38) * (p + 1.4) * (1 + d / 450)),
      customers: Math.round(((5 - r) * (3 - p)) / 5),
    })),
  ),
);

const total = (rows: Sale[], key: 'revenue' | 'customers') =>
  rows.reduce((sum, row) => sum + row[key], 0);

const groupBy = (rows: Sale[], key: (row: Sale) => string) => {
  const groups = new Map<string, Sale[]>();
  for (const row of rows) {
    const group = groups.get(key(row)) ?? [];
    group.push(row);
    groups.set(key(row), group);
  }
  return [...groups];
};

// The start of the period a day falls in, as the zone-less ISO string a time axis reads.
const periodStart = (day: Date, granularity: Granularity) => {
  const start = new Date(day);
  if (granularity === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (['month', 'quarter', 'year'].includes(granularity)) start.setDate(1);
  if (granularity === 'quarter') start.setMonth(start.getMonth() - (start.getMonth() % 3));
  if (granularity === 'year') start.setMonth(0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  return `${date}T00:00:00.000`;
};

// The windows behind the KPI's current and comparison rows: June, and the 30 days before it.
const june = { from: new Date(2026, 5, 1), to: new Date(2026, 5, 30) };
const may = { from: new Date(2026, 4, 2), to: new Date(2026, 4, 31) };
const revenueIn = (rows: Sale[], range: { from: Date; to: Date }) =>
  total(rows.filter((row) => row.day >= range.from && row.day <= range.to), 'revenue');

// ---- The dashboard

const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
  gridAutoRows: 340,
  gap: 16,
};

export function Dashboard() {
  // Three pieces of state drive the whole page.
  const [granularity, setGranularity] = useState<Granularity>('month');
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  // Clicking the selected plan again clears the filter.
  const togglePlan = (name: string) => setPlanFilter((now) => (now === name ? null : name));
  const [state, setState] = useState<NonNullable<TablePaginatedProps['state']>>({
    page: 0,
    isLoadingDownloadData: false,
  });

  const startDate = dimension({
    name: 'startDate',
    title: 'Start date',
    type: 'time',
    granularity,
    inputs: { showGranularityDropdown: true },
  });

  // Every query but the donut's takes the filter: the donut is the filter.
  const filtered = useMemo(
    () => sales.filter((row) => !planFilter || row.plan === planFilter),
    [planFilter],
  );
  const planRows = groupBy(sales, (row) => row.plan).map(([name, rows]) => ({
    plan: name,
    revenue: total(rows, 'revenue'),
  }));
  const trendRows = groupBy(filtered, (row) => periodStart(row.day, granularity)).map(
    ([start, rows]) => ({ startDate: start, revenue: total(rows, 'revenue') }),
  );
  const regionRows: Row[] = groupBy(filtered, (row) => row.region).map(
    ([name, rows]) => ({
      region: name,
      revenue: total(rows, 'revenue'),
      customers: total(rows, 'customers'),
    }),
  );

  // The table is controlled: sort, then hand it the page it asks for.
  const { page, pageSize = 10, sort } = state;
  const sign = sort?.direction === 'desc' ? -1 : 1;
  const sorted = sort
    ? [...regionRows].sort((a, b) => (a[sort.id]! > b[sort.id]! ? sign : -sign))
    : regionRows;
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <ChartsProvider>
      <div style={grid}>
        <KpiNumberComparison
          title="Revenue, last 30 days"
          measure={revenue}
          results={results([{ revenue: revenueIn(filtered, june) }])}
          resultsComparison={results([{ revenue: revenueIn(filtered, may) }])}
          comparisonPeriod="Previous period"
          primaryDateRange={june}
          comparisonDateRange={may}
          displayChangeAsPercentage
        />
        <KpiNumber
          title="Revenue, year to date"
          measure={revenueCompact}
          results={results([{ revenue: total(filtered, 'revenue') }])}
        />
        <DonutChart
          title="Revenue by plan"
          description="Click a segment to filter the whole dashboard"
          dimension={plan}
          measure={revenueCompact}
          results={results(planRows)}
          onSegmentClick={({ dimensionValue }) => dimensionValue && togglePlan(dimensionValue)}
        />
        <LineChart
          title="Revenue over time"
          description="Jan – Jun 2026"
          xAxis={startDate}
          measures={[revenueCompact]}
          results={results(trendRows)}
          granularity={granularity}
          setGranularity={setGranularity}
          showLegend={false}
          showValueLabels={false}
        />
        <BarChartHorizontal
          title="Revenue by region"
          dimension={region}
          measures={[revenueCompact]}
          results={results(regionRows)}
          showLegend={false}
        />
        <TablePaginated
          title="Revenue and customers by region"
          dimensionsAndMeasures={[region, revenue, customers]}
          results={results(pageRows)}
          totalResults={{ isLoading: false, total: regionRows.length }}
          showIndex={false}
          state={state}
          setState={setState}
        />
      </div>
    </ChartsProvider>
  );
}
