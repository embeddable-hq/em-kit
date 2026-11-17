import { LANGUAGE_STORAGE_KEY, SETTINGS_STORAGE_KEY } from '../site/settings';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { componentDefaults } from '../src/componentDefaults.generated';
import { buildChart, ChartRuntime, ChartSettings } from '../site/catalog/build';
import { datasetList, datasets } from '../site/catalog/datasets';
import { chartEntries, ChartEntry, DataState } from '../site/catalog/registry';
import { cardHeight, exampleHeight, exampleWidth, playgroundFrame, TABLE_PAGE_ROWS, tableRows } from '../site/catalog/sizes';
import { previewHeight } from '../site/components/ChartPreview';
import { DemoDashboard } from '../site/components/DemoDashboard';
import { rangeEntries } from '../site/components/landing/ChartRange';
import { ComponentExample, componentExamples, dataStates, defaultsNote, exampleCode } from '../site/content/components';
import { componentPath } from '../site/content/routes';
import { ComponentDocPage } from '../site/pages/ComponentDocPage';
import { cardExample, ComponentsIndex } from '../site/pages/ComponentsIndex';
import { SiteSettingsProvider } from '../site/state';

// Previews sized to what they draw (site/STANDARDS.md, B and H): on a
// component's page the preview is exactly as tall as the wrapper its code
// prints, so the code renders what the reader sees; an index card is never
// so short that a KPI number, a table row or a total goes missing.

const runtime: ChartRuntime = {
  granularity: 'month',
  setGranularity: () => {},
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};

type Site = Pick<ChartSettings, 'themeId' | 'languageId' | 'datasetId'>;
const site = (datasetId: Site['datasetId']): Site => ({ themeId: 'default', languageId: 'en', datasetId });

const propsOf = (entry: ChartEntry, example: ComponentExample, s: Site, dataState: DataState = 'ready') =>
  buildChart(entry, { ...s, toggles: {}, dataState, variantId: example.variantId, overrides: example.overrides }, runtime)
    .props;

/** The height the printed code gives the chart's wrapper, or undefined when it prints none. */
const codeHeight = (code: string) => {
  const match = /<div style=\{\{ (?:width: \d+, )?height: (\d+) \}\}>/.exec(code);
  return match ? Number(match[1]) : undefined;
};

const renderWith = (s: Site, node: React.ReactNode) => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
  sessionStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(s));
  const root = document.createElement('div');
  root.innerHTML = renderToString(<SiteSettingsProvider>{node}</SiteSettingsProvider>);
  return root;
};
afterEach(() => {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  sessionStorage.removeItem(LANGUAGE_STORAGE_KEY);
});

// The previews of the registry's examples: the page's own preview, then one per
// example. A hand-written example (the pivot table's sub-rows) has its own module.
const slotHeights = (root: Element, examples: ComponentExample[]) =>
  [
    root.querySelector('[data-section="preview"] .chart-slot'),
    ...examples.slice(1).map((example) => root.querySelector(`section[aria-labelledby="${example.id}"] .chart-slot`)),
  ].map((slot) => (slot ? parseFloat((slot as HTMLElement).style.height) || undefined : null));

const cases = chartEntries.flatMap((entry) => datasetList.map((ds) => [`${entry.id} · ${ds.id}`, entry, ds.id] as const));

describe('a component page preview is the height its code prints', () => {
  it.each(cases)('%s, every example', (_, entry, datasetId) => {
    const s = site(datasetId);
    const examples = componentExamples(entry);
    const page = renderWith(s, <ComponentDocPage entry={entry} route={componentPath(entry.id)} />);
    // The page's own preview shows the usage example, then one preview per example below it.
    const heights = slotHeights(page, examples);
    expect(heights).not.toContain(null);
    examples.forEach((example, i) => {
      const printed = codeHeight(exampleCode(entry, example, s));
      // A table that sizes itself prints no height; its preview holds a placeholder until it mounts.
      if (printed === undefined) return;
      expect(heights[i], `${entry.id} ${example.id}`).toBe(printed);
    });
  });

  it.each(cases)('%s, every data state: never shorter than the code', (_, entry, datasetId) => {
    const s = site(datasetId);
    for (const example of componentExamples(entry)) {
      const ready = previewHeight(entry, 'page', propsOf(entry, example, s))!;
      for (const { id: state } of dataStates) {
        const printed = codeHeight(exampleCode(entry, { ...example, dataState: state }, s));
        if (printed !== undefined) expect(ready, `${entry.id} ${example.id} ${state}`).toBeGreaterThanOrEqual(printed);
      }
    }
  });
});

describe('what each preview needs', () => {
  const each = chartEntries.flatMap((entry) =>
    componentExamples(entry).flatMap((example) =>
      datasetList.map((ds) => ({ entry, example, s: site(ds.id), where: `${entry.id} ${example.id} ${ds.id}` })),
    ),
  );

  it('a KPI number gets at least 40px under its card chrome (120px), and the comparison line its own 40px', () => {
    // At 160px a KPI with a comparison drew its number at 12px in a 3px box.
    for (const { entry, example, s, where } of each.filter((c) => c.entry.group === 'KPIs')) {
      const props = propsOf(entry, example, s);
      const comparison = 'resultsComparison' in props;
      expect(previewHeight(entry, 'page', props), where).toBeGreaterThanOrEqual(comparison ? 200 : 160);
    }
  });

  it('a chart with KPI tabs leaves the plot 200px: 460px on the page', () => {
    for (const { entry, example, s, where } of each.filter((c) => String(c.entry.exportName).includes('KpiTabs'))) {
      expect(previewHeight(entry, 'page', propsOf(entry, example, s)), where).toBeGreaterThanOrEqual(460);
      expect(cardHeight(entry, propsOf(entry, example, s)), where).toBeGreaterThanOrEqual(400);
    }
  });

  it('a pivot table or heat map shows every row and its totals, on the page and on the index', () => {
    let checked = 0;
    for (const { entry, example, s, where } of each) {
      const props = propsOf(entry, example, s);
      const rows = tableRows(entry, props);
      if (!rows) continue;
      checked++;
      // Rows are 40px; the page's card takes 120px round them, the index card 80px.
      expect(exampleHeight(entry, props), where).toBeGreaterThanOrEqual(120 + 40 * rows);
      expect(cardHeight(entry, props), where).toBeGreaterThanOrEqual(80 + 40 * rows);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the pivot table counts its header, row values and total rows', () => {
    const pivot = chartEntries.find((e) => e.exportName === 'PivotTable')!;
    for (const ds of datasetList) {
      const props = propsOf(pivot, componentExamples(pivot)[0]!, site(ds.id));
      const data = (props.results as { data: Record<string, unknown>[] }).data;
      const values = new Set(data.map((row) => row[ds.specs.category.name])).size;
      expect(values, ds.id).toBeGreaterThan(3);
      // Two header rows, one per row value, one Sum row.
      expect(tableRows(pivot, props), ds.id).toBe(2 + values + 1);
    }
  });
});

describe('a funnel never puts a label on a step narrower than it', () => {
  const funnel = chartEntries.find((e) => e.exportName === 'FunnelChart')!;
  const labelsOff = (props: Record<string, unknown>) =>
    props.showLegend === true && props.showSectionLabels === false && props.showValueLabels === false;

  it('the components index shows the small-card preset: steps in the legend, counts in the tooltips', () => {
    const example = cardExample(funnel);
    expect(example.variantId).toBe('small-card');
    for (const ds of datasetList) expect(labelsOff(propsOf(funnel, example, site(ds.id))), ds.id).toBe(true);
    const index = renderWith(site('saas'), <ComponentsIndex route="/docs/components" />);
    expect(index.querySelectorAll('.index-card')).toHaveLength(chartEntries.length);
  });

  it('so does the funnel card in the landing range', () => {
    const item = rangeEntries.find((r) => r.entry.exportName === 'FunnelChart')!;
    expect(labelsOff({ ...item.overrides?.overrides })).toBe(true);
  });

  it('every other component keeps its default on the index', () => {
    for (const entry of chartEntries.filter((e) => e !== funnel)) {
      expect(cardExample(entry).id, entry.id).toBe('usage');
    }
  });
});

describe('example dashboard', () => {
  it('the KPI beside the half-year trend is the year to date, not twelve months', () => {
    const root = renderWith(site('saas'), <DemoDashboard />);
    const text = root.textContent ?? '';
    expect(text).not.toMatch(/12 months/);
    // The KPI is a chart: its title is a translation key, "app.<dataset>.yearToDate|Revenue, year to date".
    expect(root.innerHTML).toContain('year to date');
  });
});

// Round 3 (site/STANDARDS.md, B, D and H): usage code that shows each component
// as it comes, the component call near the top of it, tables and grids with no
// band under them, and a small card drawn small.

describe('usage examples use the components’ defaults', () => {
  // The one default they turn off: value labels over points, which run into
  // the value axis on lines and areas and cover each other on a scatter.
  const allowed: Record<string, string[]> = {
    // The line on a bar and line combo runs through the tallest bar's label.
    BarLineChart: ['showValueLabels'],
    LineChart: ['showValueLabels'],
    LineChartGrouped: ['showValueLabels'],
    LineChartComparison: ['showValueLabels'],
    LineChartWithKpiTabs: ['showValueLabels'],
    LineChartComparisonWithKpiTabs: ['showValueLabels'],
    AreaChart: ['showValueLabels'],
    ScatterChart: ['showValueLabels'],
    // Bubbles sized for a third of a row, kept clear of the axes.
    BubbleChart: ['showValueLabels', 'bubbleRadiusMin', 'bubbleRadiusMax'],
  };

  it.each(chartEntries.map((entry) => [entry.id, entry] as const))('%s sets no default to another value without a reason', (_, entry) => {
    const name = String(entry.exportName);
    const defaults = (componentDefaults as Record<string, Record<string, unknown>>)[name] ?? {};
    const props = propsOf(entry, componentExamples(entry)[0]!, site('saas'));
    const changed = Object.keys(defaults).filter((key) => key in props && JSON.stringify(props[key]) !== JSON.stringify(defaults[key]));
    expect(changed.filter((key) => !(allowed[name] ?? []).includes(key))).toEqual([]);
  });

  it('so no example has to explain a default its code leaves out', () => {
    for (const entry of chartEntries) {
      for (const example of componentExamples(entry)) expect(defaultsNote(entry, example), `${entry.id} ${example.id}`).toBe('');
    }
  });

  it.each(chartEntries.map((entry) => [entry.id, entry] as const))('%s prints the component before its sample data', (_, entry) => {
    const code = exampleCode(entry, componentExamples(entry)[0]!, site('saas'));
    const lines = code.split('\n');
    const element = lines.findIndex((line) => line.trim() === `<${String(entry.exportName)}`);
    const data = lines.findIndex((line) => /^const \w+(: [^=]+)? = \[|^const \w+Range = \{$|^const \w+Range = \{ from/.test(line));
    expect(element).toBeGreaterThan(0);
    if (data >= 0) expect(element, code).toBeLessThan(data);
    // The call starts within the first screen of the code block (about 36 lines at 1440×900).
    expect(element, code).toBeLessThanOrEqual(36);
  });
});

describe('tables and grids are as tall as their rows', () => {
  const page = (id: string, s = site('saas')) => {
    const entry = chartEntries.find((e) => e.id === id)!;
    return { entry, props: propsOf(entry, componentExamples(entry)[0]!, s) };
  };

  it('a paginated table shows every row of its first page, with no band above the pager', () => {
    for (const ds of datasetList) {
      const { entry, props } = page('table', site(ds.id));
      // Four rows a page, so the sample spans two pages and the pager works.
      const rows = Math.min(ds.byCategory.length, TABLE_PAGE_ROWS);
      // Card chrome 120, a header row and a row each at 40, the pager at 48.
      const needed = 120 + 40 * (rows + 1) + 48;
      expect(exampleHeight(entry, props)).toBeGreaterThanOrEqual(needed);
      expect(exampleHeight(entry, props)! - needed).toBeLessThan(10);
      expect(cardHeight(entry, props) - (80 + 40 * (rows + 1) + 48)).toBeLessThan(10);
    }
  });

  it('a heat map is as tall as its grid', () => {
    const { entry, props } = page('heatmap');
    expect(exampleHeight(entry, props)).toBe(120 + 40 * tableRows(entry, props)!);
  });

  it('the scrollable table’s card is as tall as the paginated table’s beside it', () => {
    const table = page('table');
    const scrollable = page('table-scrollable');
    expect(cardHeight(scrollable.entry, scrollable.props)).toBe(cardHeight(table.entry, table.props));
  });
});

describe('a small card is drawn small', () => {
  const funnel = chartEntries.find((e) => e.exportName === 'FunnelChart')!;
  const small = componentExamples(funnel).find((e) => e.variantId === 'small-card')!;

  it('its code gives the wrapper 320px, and its page preview takes that width', () => {
    expect(exampleWidth(funnel, 'small-card')).toBe(320);
    expect(exampleCode(funnel, small, site('saas'))).toContain('<div style={{ width: 320, height: 360 }}>');
    const page = renderWith(site('saas'), <ComponentDocPage entry={funnel} route={componentPath(funnel.id)} />);
    const slot = page.querySelector('#small-card')!.closest('section')!.querySelector<HTMLElement>('.chart-slot')!;
    expect(slot.style.width).toBe('320px');
    // Every other preview fills its column.
    expect([...page.querySelectorAll<HTMLElement>('.chart-slot')].filter((el) => el.style.width)).toHaveLength(1);
  });

  it('the playground preset draws it at the size its code prints, not a tall column', () => {
    const props = propsOf(funnel, small, site('saas'));
    expect(playgroundFrame(funnel, 'small-card', props)).toMatchObject({ width: 320, height: codeHeight(exampleCode(funnel, small, site('saas'))) });
    expect(playgroundFrame(funnel, undefined, propsOf(funnel, componentExamples(funnel)[0]!, site('saas')))).toEqual({ height: 480 });
  });
});

describe('the components index', () => {
  it('opens each card’s code across its row, from a button that says whether it is open', () => {
    const index = renderWith(site('saas'), <ComponentsIndex route="/docs/components" />);
    const cards = [...index.querySelectorAll('.index-card')];
    expect(cards.length).toBe(chartEntries.length);
    for (const card of cards) {
      const button = card.querySelector('.index-card__view')!;
      expect(button.textContent).toBe('View code');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      // A panel of the row's width, not a pane inside a third-width card.
      const panel = index.querySelector(`#${button.getAttribute('aria-controls')}`)!;
      expect(panel.classList.contains('index-code')).toBe(true);
      expect(card.contains(panel)).toBe(false);
      expect(panel.hasAttribute('hidden')).toBe(true);
    }
  });
});

describe('example dashboard figures', () => {
  it('shows the same last-30-days revenue as the KPI card on the components index', () => {
    const root = renderWith(site('saas'), <DemoDashboard />);
    const total = Number(datasets.saas.total[datasets.saas.specs.primary.name]);
    expect(root.innerHTML).toContain(total.toLocaleString('en-US'));
  });
});
