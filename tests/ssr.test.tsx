// @vitest-environment node
// Server rendering: the package imports and renders in plain Node, with no DOM
// globals, as in a Next.js App Router, Remix or Astro server render. Charts
// render their card (title, and rows for tables) with an empty canvas that
// chart.js fills on the client.
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BarChart,
  ChartsProvider,
  DonutChart,
  DonutLabelChart,
  FunnelChart,
  KpiNumber,
  LineChart,
  PieChart,
  PivotTable,
  TablePaginated,
  TableScrollable,
  dimension,
  measure,
  results,
} from '../src';
import { RevenueChart } from '../site/examples/RevenueChart';
import { buildChart } from '../site/catalog/build';
import { datasets } from '../site/catalog/datasets';
import { getComponent } from '../site/catalog/chartComponents';
import { chartEntries, DataState } from '../site/catalog/registry';
import { chartTitle } from '../site/catalog/translations';
import { SERVER_RENDER_EXCEPTIONS } from '../site/content/guides';

const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });
const plan = dimension({ name: 'plan', title: 'Plan' });
const region = dimension({ name: 'region', title: 'Region' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { currency: 'USD', decimalPlaces: 0 } });

const monthly = results([
  { month: '2026-01-01T00:00:00.000', revenue: 48200 },
  { month: '2026-02-01T00:00:00.000', revenue: 51900 },
]);
const byPlan = results([
  { plan: 'Starter', revenue: 18400 },
  { plan: 'Growth', revenue: 42900 },
]);
const byPlanAndRegion = results([
  { plan: 'Starter', region: 'Europe', revenue: 18400 },
  { plan: 'Growth', region: 'Europe', revenue: 42900 },
  { plan: 'Starter', region: 'Americas', revenue: 21700 },
]);

const serverRender = (node: React.ReactElement) => renderToString(<ChartsProvider>{node}</ChartsProvider>);

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errors = vi.spyOn(console, 'error');
});
afterEach(() => {
  expect(errors).not.toHaveBeenCalled();
  errors.mockRestore();
});

describe('server render without a DOM', () => {
  it('runs in Node, not jsdom', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
    expect(typeof getComputedStyle).toBe('undefined');
  });

  it('imports the package', async () => {
    const lib = await import('../src');
    expect(lib.ChartsProvider).toBeTypeOf('function');
  });

  it('renders the quick start chart', () => {
    const html = serverRender(<RevenueChart />);
    expect(html).toContain('Revenue by region');
    expect(html).toContain('<canvas');
  });

  it('renders a bar chart', () => {
    const html = serverRender(<BarChart title="Revenue by plan" dimension={plan} measures={[revenue]} results={byPlan} />);
    expect(html).toContain('Revenue by plan');
    expect(html).toContain('<canvas');
  });

  it('renders a KPI number', () => {
    const html = serverRender(
      <KpiNumber title="Total revenue" measure={revenue} results={results([{ revenue: 48200 }])} />,
    );
    expect(html).toContain('Total revenue');
    expect(html).toContain('$48,200');
  });

  it('renders a line chart', () => {
    const html = serverRender(<LineChart title="Revenue over time" xAxis={month} measures={[revenue]} results={monthly} />);
    expect(html).toContain('Revenue over time');
    expect(html).toContain('<canvas');
  });

  it('renders a pie chart', () => {
    const html = serverRender(<PieChart title="Revenue share" dimension={plan} measure={revenue} results={byPlan} />);
    expect(html).toContain('Revenue share');
    expect(html).toContain('<canvas');
  });

  it('renders a funnel chart', () => {
    const html = serverRender(
      <FunnelChart title="Pipeline" sectionDimension={plan} countMeasure={revenue} results={byPlan} />,
    );
    expect(html).toContain('Pipeline');
    expect(html).toContain('<canvas');
  });

  it('renders a paginated table with its rows', () => {
    const html = serverRender(
      <TablePaginated
        title="Plans"
        dimensionsAndMeasures={[plan, revenue]}
        results={byPlan}
        state={{ page: 0, isLoadingDownloadData: false }}
        setState={() => {}}
      />,
    );
    expect(html).toContain('Plans');
    expect(html).toContain('Starter');
    expect(html).toContain('$42,900');
  });

  it('renders a pivot table with its rows', () => {
    const html = serverRender(
      <PivotTable
        title="Revenue by plan and region"
        rowDimension={plan}
        columnDimension={region}
        measures={[revenue]}
        results={byPlanAndRegion}
        expandedRowKeys={[]}
        setExpandedRowKey={() => {}}
      />,
    );
    expect(html).toContain('Revenue by plan and region');
    expect(html).toContain('Growth');
    expect(html).toContain('Americas');
    expect(html).toContain('$21,700');
  });
});

// What Troubleshooting says a server render leaves to the browser (SERVER_RENDER_EXCEPTIONS).
describe('the components that wait for the browser', () => {
  it('a pie renders its canvas on the server; the two donuts do not', () => {
    expect(serverRender(<PieChart dimension={plan} measure={revenue} results={byPlan} />)).toContain('<canvas');
    expect(serverRender(<DonutChart dimension={plan} measure={revenue} results={byPlan} />)).not.toContain('<canvas');
    expect(
      serverRender(<DonutLabelChart dimension={plan} measure={revenue} results={byPlan} innerLabelMeasure={revenue} resultsInnerLabel={results([{ revenue: 1 }])} />),
    ).not.toContain('<canvas');
    expect(SERVER_RENDER_EXCEPTIONS).toContain('the donut and the donut with total draw their chart after they mount');
  });

  it('a scrollable table shows its empty state, not its rows', () => {
    const html = serverRender(<TableScrollable dimensionsAndMeasures={[plan, revenue]} results={byPlan} />);
    expect(html).not.toContain('Starter');
    expect(SERVER_RENDER_EXCEPTIONS).toContain('the scrollable table shows its empty state until it hydrates');
  });
});

describe('every exported chart renders on the server', () => {
  const runtime = {
    granularity: 'month' as const,
    setGranularity: () => {},
    tableState: { page: 0, isLoadingDownloadData: false },
    setTableState: () => {},
    onEvent: () => {},
  };
  const dataStates: DataState[] = ['ready', 'loading', 'empty', 'error'];

  describe.each(chartEntries.map((entry) => [entry.exportName, entry] as const))('%s', (_, entry) => {
    const Component = getComponent(entry);
    it.each(dataStates)('in the %s state', (dataState) => {
      const settings = { datasetId: 'saas', dataState, toggles: {}, themeId: 'default', languageId: 'en' } as const;
      const { props } = buildChart(entry, settings, runtime);
      const html = serverRender(<Component {...props} />);
      if (dataState === 'ready') expect(html).toContain(chartTitle(datasets.saas, entry.id));
      else expect(html).not.toBe('');
    });
  });
});
