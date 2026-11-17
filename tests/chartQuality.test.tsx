import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildChart, ChartRuntime, ChartSettings } from '../site/catalog/build';
import { datasetList, Row } from '../site/catalog/datasets';
import { chartEntries, titleId } from '../site/catalog/registry';
import { buildTheme, languages, themePresets } from '../site/catalog/themes';
import { chartTitle } from '../site/catalog/translations';
import { Dashboard } from '../site/examples/Dashboard';
import { defaultStyles } from '../src/theme';

// What keeps the chart previews looking right (site/STANDARDS.md, B and H):
// titles that match the data in every dataset and language, sample data small
// enough that no axis label has to tilt in a card on the components index,
// numbers that agree with each other, and a font that never falls back to serif.

const runtime: ChartRuntime = {
  granularity: 'month',
  setGranularity: () => {},
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};

const settingsFor = (datasetId: ChartSettings['datasetId'], variantId?: string): ChartSettings => ({
  datasetId,
  variantId,
  dataState: 'ready',
  toggles: {},
  themeId: 'default',
  languageId: 'en',
});

type Field = { name: string; nativeType: string };
const rowsOf = (value: unknown): Row[] => (value as { data?: Row[] } | undefined)?.data ?? [];
const sumOf = (rows: Row[], column: string) => rows.reduce((sum, row) => sum + Number(row[column] ?? 0), 0);

describe('chart titles', () => {
  it('every chart and preset has a title in every dataset and language', () => {
    for (const ds of datasetList) {
      for (const { id: lang } of languages) {
        for (const entry of chartEntries) {
          for (const variant of [undefined, ...(entry.variants ?? [])]) {
            const id = titleId(entry, variant);
            const title = chartTitle(ds, id, lang);
            expect(title, `${ds.id} ${lang} ${id}`).toBeTruthy();
            expect(title, `${ds.id} ${lang} ${id}`).not.toMatch(/[{}|]|undefined/);
          }
        }
      }
    }
  });

  it('a title names the measure the chart plots', () => {
    for (const ds of datasetList) {
      for (const entry of chartEntries) {
        const { props } = buildChart(entry, settingsFor(ds.id), runtime);
        const measures = Object.values(props)
          .flat()
          .filter((v): v is Field & { title: string; __type__: string } => (v as Field)?.nativeType === 'number')
          .map((field) => field.title.toLowerCase());
        const title = (chartTitle(ds, entry.id) ?? '').toLowerCase();
        expect(
          measures.some((name) => title.includes(name)),
          `${ds.id} ${entry.id}: "${title}" names none of ${measures.join(', ')}`,
        ).toBe(true);
      }
    }
  });
});

describe('default previews fit a card on the components index', () => {
  // The charts tilt axis labels that do not fit before they drop any, so the
  // sample data has to be small: at most four periods or five short categories.
  const vertical = new Set([
    'BarChart',
    'BarChartGrouped',
    'BarChartStacked',
    'BarLineChart',
    'LineChart',
    'LineChartGrouped',
    'LineChartComparison',
    'LineChartWithKpiTabs',
    'LineChartComparisonWithKpiTabs',
    'AreaChart',
  ]);

  it.each(datasetList.map((ds) => [ds.id, ds] as const))('%s', (_, ds) => {
    for (const entry of chartEntries.filter((e) => vertical.has(String(e.exportName)))) {
      const { props } = buildChart(entry, settingsFor(ds.id), runtime);
      const axis = (props.xAxis ?? props.dimension) as Field;
      const labels = [...new Set(rowsOf(props.results).map((row) => String(row[axis.name])))];
      const where = `${ds.id} ${entry.id}`;
      if (axis.nativeType === 'time') {
        expect(labels.length, where).toBeLessThanOrEqual(4);
      } else {
        expect(labels.length, where).toBeLessThanOrEqual(5);
        for (const label of labels) expect(label.length, `${where} "${label}"`).toBeLessThanOrEqual(10);
      }
    }
  });
});

describe('sample data', () => {
  it.each(datasetList.map((ds) => [ds.id, ds] as const))('%s: every breakdown of a measure adds up to the same total', (_, ds) => {
    for (const measure of [ds.specs.primary.name, ds.specs.secondary.name]) {
      const total = sumOf(ds.byCategory, measure);
      for (const [name, rows] of Object.entries({
        byCategoryGroup: ds.byCategoryGroup,
        byCategoryPair: ds.byCategoryPair,
        byGroup: ds.byGroup,
        bySegment: ds.bySegment,
        byGroupSegment: ds.byGroupSegment,
        byGroupPair: ds.byGroupPair,
        bySegmentPair: ds.bySegmentPair,
        'byTime(month)': ds.byTime('month'),
      })) {
        // Each row is rounded on its own, so allow one unit per row.
        expect(Math.abs(sumOf(rows, measure) - total), `${measure} in ${name}`).toBeLessThanOrEqual(rows.length + 20);
      }
    }
  });

  it.each(datasetList.map((ds) => [ds.id, ds] as const))('%s: the funnel narrows at every step', (_, ds) => {
    const counts = ds.byStage.map((row) => Number(row[ds.extra.funnel.name]));
    expect(counts.length).toBeGreaterThan(3);
    counts.slice(1).forEach((count, i) => expect(count).toBeLessThan(counts[i]!));
  });

  it.each(datasetList.map((ds) => [ds.id, ds] as const))('%s: each funnel step is wider than its label on a component page', (_, ds) => {
    // The funnel draws "Step: count" on a pill inside each step, and a step is
    // as wide as its share of the first: about 680px for the first on a page.
    // Wider than its step, a pill cuts the step in two. (Index cards are too
    // narrow for any labels: they show the funnel's small-card preset.)
    const stage = ds.specs.stage.name;
    const count = ds.extra.funnel.name;
    const top = Number(ds.byStage[0]![count]);
    for (const row of ds.byStage) {
      const label = `${row[stage]}: ${Number(row[count]).toLocaleString('en-US')}`;
      // 12px medium text is under 7px a character; the pill adds 4px a side.
      expect(7 * label.length + 8, `${ds.id} "${label}"`).toBeLessThanOrEqual((680 * Number(row[count])) / top);
    }
  });

  it.each(datasetList.map((ds) => [ds.id, ds] as const))('%s: segments are in name order', (_, ds) => {
    // The heat map and pivot table re-sort a dimension whose values are neither ascending nor descending.
    const segments = ds.bySegment.map((row) => String(row[ds.extra.segment.name]));
    expect(segments).toEqual([...segments].sort());
  });

  it.each(datasetList.map((ds) => [ds.id, ds] as const))('%s: the 30-day figures cover 30 days', (_, ds) => {
    const lastMonth = ds.byTime('month').at(-1)!;
    // June has 30 days, so the last 30 days are the last month of the series.
    expect(ds.total[ds.specs.primary.name]).toBe(lastMonth[ds.specs.primary.name]);
    expect(Number(ds.previousTotal[ds.specs.primary.name])).toBeGreaterThan(0);
  });
});

describe('chart font', () => {
  it('the package default names fallbacks after Inter, ending in a generic family', () => {
    expect(defaultStyles['--em-core-font-family--base']).toMatch(/^'Inter', .+, sans-serif$/);
  });

  it('no site theme replaces that stack with one that has no fallbacks', () => {
    for (const preset of themePresets) {
      const stack = (buildTheme(preset.id, 'en').styles as Record<string, string>)['--em-core-font-family--base'];
      if (stack !== undefined) expect(stack, preset.id).toMatch(/^'Inter', .+, sans-serif$/);
    }
  });
});

describe('example dashboard', () => {
  it('the standalone module renders with its own data', () => {
    const html = renderToString(<Dashboard />);
    for (const text of ['Revenue, last 30 days', 'Revenue by plan', 'Revenue over time', 'Revenue by region']) {
      expect(html).toContain(text);
    }
    // The table is plain HTML, so its rows are in the markup.
    expect(html).toContain('North America');
    expect(html).not.toContain('NaN');
  });
});
