import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartsProvider, TableScrollable, dimension, measure, results } from '../src';
import { buildChart, ChartSettings } from '../site/catalog/build';
import { chartEntries, DataState, getComponent } from '../site/catalog/registry';
import { buildTheme } from '../site/catalog/themes';

// Smoke tests over the public surface: every exported chart renders, with
// realistic props from the site registry, in every data state, in English and
// a translated locale. Effects don't run under renderToString, so chart.js
// never needs a canvas; a throw or an empty render is the failure signal.

const runtime = {
  granularity: 'month' as const,
  setGranularity: () => {},
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};

const settings = (dataState: DataState, languageId: 'en' | 'de' = 'en'): ChartSettings => ({
  datasetId: 'saas',
  dataState,
  toggles: {},
  themeId: 'default',
  languageId,
});

const render = (node: React.ReactElement, languageId: 'en' | 'de' = 'en') =>
  renderToString(<ChartsProvider theme={buildTheme('default', languageId)}>{node}</ChartsProvider>);

const dataStates: DataState[] = ['ready', 'loading', 'empty', 'error'];

describe.each(chartEntries.map((entry) => [entry.exportName, entry] as const))('%s', (_, entry) => {
  const Component = getComponent(entry);

  it.each(dataStates)('renders in the %s state', (dataState) => {
    const { props } = buildChart(entry, settings(dataState), runtime);
    const html = render(<Component {...props} />);
    expect(html).not.toBe('');
  });

  it('renders the resolved title', () => {
    const { props } = buildChart(entry, settings('ready'), runtime);
    const html = render(<Component {...props} />);
    // Titles are "key|fallback"; the key must never leak into the output.
    expect(html).not.toContain('titles.saas');
    expect(html).toContain('Revenue');
  });

  it('renders translated', () => {
    const { props } = buildChart(entry, settings('ready', 'de'), runtime);
    const html = render(<Component {...props} />, 'de');
    expect(html).toContain('Umsatz');
  });
});

describe('prop overrides', () => {
  it('reach both the rendered props and the generated code', () => {
    const entry = chartEntries.find((e) => e.id === 'bar')!;
    const { props, code } = buildChart(
      entry,
      { ...settings('ready'), overrides: { yAxisLabel: 'Total', showLegend: false, title: 'Edited' } },
      runtime,
    );
    expect(props.yAxisLabel).toBe('Total');
    expect(props.showLegend).toBe(false);
    expect(props.title).toBe('Edited');
    expect(code).toContain('yAxisLabel="Total"');
    expect(code).toContain('title="Edited"');
  });
});

describe('TableScrollable', () => {
  const region = dimension({ name: 'region', title: 'Region' });
  const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { prefix: '$' } });
  const rows = [
    { region: 'Europe', revenue: 100 },
    { region: 'North America', revenue: 200 },
  ];

  it('renders without an Embeddable dataset prop', () => {
    const html = render(
      <TableScrollable
        title="Breakdown"
        dimensionsAndMeasures={[region, revenue]}
        results={results(rows)}
        resetKey={{ filter: null }}
        state={{ page: 0, isLoadingDownloadData: false }}
        setState={() => {}}
      />,
    );
    expect(html).toContain('Breakdown');
  });
});
