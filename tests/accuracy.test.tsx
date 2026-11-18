import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { BarChart, BarChartStacked, ChartsProvider, LineChart, LineChartGrouped, ScatterChart, TableScrollable, dimension, measure, results } from '../src';
import { componentDefaults } from '../src/componentDefaults.generated';
import { isAutoHeight } from '../src/generated/components/charts/tables/TableScrollable/TableScrollable.autoHeight';
import { defaultComparisonPeriodOptions } from '../src/generated/theme/defaults/defaults.ComparisonPeriods.constants';
import { buildChart, ChartSettings } from '../site/catalog/build';
import { fieldOptionDefault, ignoredFieldOptions } from '../site/catalog/fieldOptionNotes';
import { codeDefaults, COMPARISON_PERIODS, GRANULARITIES, ignoredProps } from '../site/catalog/propNotes';
import { getComponent } from '../site/catalog/chartComponents';
import { ChartEntry, chartEntries, TableState } from '../site/catalog/registry';
import {
  axisOrderNote,
  componentExamples,
  componentPageMarkdown,
  defaultsNote,
  exampleCode,
  keyboardRows,
  notesOf,
  propDefault,
  PROVIDER_ERROR,
  propDescription,
  propsOf,
  propType,
  purposeOf,
  typeShapes,
} from '../site/content/components';
import { componentPath } from '../site/content/routes';
import { componentFieldOptions, componentProps, typeDefinitions } from '../site/generated/props';
import { ComponentDocPage } from '../site/pages/ComponentDocPage';
import { SiteSettingsProvider } from '../site/state';

// The docs against the code. Every check here renders the library or reads its
// types, because the review that asked for this file found the docs saying
// five things the code does not do: a provider symptom, field option defaults
// the package never applies, a granularity it dropped, type names nothing
// defines, and a table download that never finishes.

// Chart.js needs a canvas. The chart components hand it their data and
// options; this stands in for it and keeps what each one was given.
const drawn: { kind: string; data: unknown; options: unknown }[] = [];
vi.mock('react-chartjs-2', () => {
  const chart = (kind: string) => (props: { data: unknown; options: unknown }) => {
    drawn.push({ kind, data: props.data, options: props.options });
    return null;
  };
  return {
    getElementAtEvent: () => [],
    getElementsAtEvent: () => [],
    getDatasetAtEvent: () => [],
    Bar: chart('Bar'),
    Line: chart('Line'),
    Pie: chart('Pie'),
    Doughnut: chart('Doughnut'),
    Scatter: chart('Scatter'),
    Bubble: chart('Bubble'),
    Chart: chart('Chart'),
  };
});
// The PNG download draws the card to an image, which jsdom cannot.
vi.mock('dom-to-image-more', () => ({
  default: { toPng: async () => 'data:image/png;base64,iVBORw0KGgo=' },
}));

const each = chartEntries.map((e) => [e.id, e] as const);
const nameOf = (entry: ChartEntry) => String(entry.exportName);
const base = { themeId: 'default', languageId: 'en', datasetId: 'saas' } as const;
const settings: ChartSettings = { ...base, dataState: 'ready', toggles: {} };
const runtime = {
  granularity: 'month' as const,
  setGranularity: () => {},
  tableState: { page: 0, pageSize: 10, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};

const sentencesOf = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z`(])/);
const markdownOf = new Map(chartEntries.map((e) => [e.id, componentPageMarkdown(e)]));

// ---- Rendering in jsdom ------------------------------------------------------

const realRect = Element.prototype.getBoundingClientRect;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // A card measures itself before it draws (a donut with no room draws nothing).
  Element.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}) }) as DOMRect;
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
});

const mount = (node: React.ReactNode) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<ChartsProvider>{node}</ChartsProvider>));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
};

const serialise = (value: unknown) => JSON.stringify(value, (_key, v) => (typeof v === 'function' ? '[fn]' : v));

// The callbacks in a chart's options (labels, tooltips, ticks) decide what is
// printed, so their output is part of what a chart draws. Each is called with
// a few points of the chart's own data.
const callbackOutput = (chart: { data: unknown; options: unknown }) => {
  const data = (chart.data ?? {}) as { labels?: unknown[]; datasets?: { data?: unknown[] }[] };
  const labels = data.labels ?? [];
  const datasets = data.datasets?.length ? data.datasets.slice(0, 3) : [{ data: [] }];
  const scale = { getLabelForValue: (v: number) => labels[v], ticks: [], options: {}, getPixelForValue: () => 0 };
  const stub = {
    data,
    options: chart.options,
    scales: { x: scale, y: scale },
    getDatasetMeta: () => ({ data: [], hidden: false, total: 100 }),
    isDatasetVisible: () => true,
    chartArea: { left: 0, right: 400, top: 0, bottom: 300, width: 400, height: 300 },
  };
  const out: string[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown, path: string) => {
    if (!node || seen.has(node)) return;
    if (typeof node === 'function') {
      datasets.forEach((dataset, datasetIndex) => {
        for (const dataIndex of [0, 1, 2]) {
          const raw = dataset.data?.[dataIndex];
          const ctx = {
            chart: stub,
            dataset,
            datasetIndex,
            dataIndex,
            raw,
            parsed: { x: dataIndex, y: raw },
            label: labels[dataIndex],
            formattedValue: String(raw),
          };
          for (const args of [[raw, ctx], [ctx], [dataIndex, dataIndex, []], [[ctx]]]) {
            let result: string;
            try {
              result = serialise((node as (...a: unknown[]) => unknown).apply(scale, args));
            } catch (error) {
              result = `threw ${(error as Error).message}`;
            }
            out.push(`${path}#${datasetIndex}.${dataIndex}=${result}`);
          }
        }
      });
      return;
    }
    if (typeof node !== 'object') return;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
  };
  walk(chart.options, 'options');
  return out;
};

/** Everything a chart puts on screen: its markup, and what it hands Chart.js. */
const fingerprint = (entry: ChartEntry, props: Record<string, unknown>) => {
  drawn.length = 0;
  const Component = getComponent(entry);
  const { container, unmount } = mount(
    <div style={{ height: 400 }}>
      <Component {...props} />
    </div>,
  );
  // React's ids differ from one render to the next.
  const html = container.innerHTML.replace(/_r_[0-9a-z]+_|:r[0-9a-z]+:/g, 'ID');
  unmount();
  const last = new Map(drawn.map((chart) => [chart.kind, chart]));
  return serialise({
    html,
    charts: [...last.values()].map((chart) => ({ data: serialise(chart.data), options: serialise(chart.options), callbacks: callbackOutput(chart) })),
  });
};

type Field = { __type__: string; name: string; inputs?: Record<string, unknown> };
const isField = (value: unknown): value is Field => typeof value === 'object' && value !== null && '__type__' in value;
const isResponse = (value: unknown): value is { isLoading: boolean; data?: unknown[] } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as { isLoading?: unknown }).isLoading === 'boolean';

/** The default example's props, with one row missing from each result set so a time axis has a gap to fill. */
const propsWithAGap = (entry: ChartEntry) =>
  Object.fromEntries(
    Object.entries(buildChart(entry, settings, runtime).props).map(([key, value]) => [
      key,
      isResponse(value) && (value.data?.length ?? 0) >= 3 ? { ...value, data: value.data!.filter((_, i) => i !== 1) } : value,
    ]),
  );

/** The same props with `inputs` changed on the fields that the named props hold. */
const withInputs = (props: Record<string, unknown>, fieldProps: string[], change: (inputs: Record<string, unknown>) => Record<string, unknown>) => {
  const apply = (field: unknown) => (isField(field) ? { ...field, inputs: change({ ...field.inputs }) } : field);
  return Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, fieldProps.includes(key) ? (Array.isArray(value) ? value.map(apply) : apply(value)) : value]),
  );
};

// ---- G1: the provider ---------------------------------------------------------

describe('the provider', () => {
  it('the symptom the pages give is the error a chart throws without it', () => {
    const region = dimension({ name: 'region' });
    const revenue = measure({ name: 'revenue' });
    let thrown = '';
    try {
      renderToString(<BarChart dimension={region} measures={[revenue]} results={results([{ region: 'Europe', revenue: 1 }])} />);
    } catch (error) {
      thrown = (error as Error).message;
    }
    expect(thrown).toBe(PROVIDER_ERROR);
  });

  it.each(each)('%s says what happens without it', (_, entry) => {
    const markdown = markdownOf.get(entry.id)!;
    expect(markdown).toContain(`without it every chart throws \`${PROVIDER_ERROR}\``);
    expect(markdown).not.toMatch(/render unstyled/);
    // The App Router line, until the package ships its own directive: both
    // files, and the locale pinned so the server's numbers match the browser's.
    expect(markdown).toContain("every file that renders `ChartsProvider` or a chart starts with `'use client'`");
    expect(markdown).toContain("`theme={{ formatter: { locale: 'en-US' } }}`");
    expect(markdown.includes('as hex, such as')).toBe(nameOf(entry) === 'HeatMap');
  });
});

// ---- G3: granularity --------------------------------------------------------

describe('a time field’s granularity', () => {
  it('dimension() keeps it from inputs, and the top-level value wins', () => {
    expect(dimension({ name: 't', type: 'time', inputs: { granularity: 'month' } }).inputs?.granularity).toBe('month');
    expect(dimension({ name: 't', type: 'time', granularity: 'month' }).inputs?.granularity).toBe('month');
    expect(dimension({ name: 't', type: 'time', granularity: 'week', inputs: { granularity: 'month' } }).inputs?.granularity).toBe('week');
    expect(dimension({ name: 't', type: 'time', inputs: { showGranularityDropdown: true } }).inputs).toEqual({
      showGranularityDropdown: true,
      granularity: undefined,
    });
    expect(dimension({ name: 'region' }).inputs).toBeUndefined();
  });

  it('labels and fills the axis the same, written either way; the chart prop does neither', () => {
    const revenue = measure({ name: 'revenue', title: 'Revenue' });
    const rows = [
      { month: '2026-01-01T00:00:00.000', revenue: 1 },
      { month: '2026-03-01T00:00:00.000', revenue: 3 },
    ];
    const draw = (field: ReturnType<typeof dimension>, granularity?: 'month') => {
      drawn.length = 0;
      const { unmount } = mount(
        <div style={{ height: 400 }}>
          <BarChart dimension={field} measures={[revenue]} results={results(rows)} granularity={granularity} />
        </div>,
      );
      unmount();
      const chart = drawn.at(-1)!;
      const labels = (chart.data as { labels: string[] }).labels;
      const tick = (chart.options as { scales: { x: { ticks: { callback: (this: unknown, v: number) => string } } } }).scales.x.ticks.callback;
      return { labels, shown: labels.map((_, i) => tick.call({ getLabelForValue: (v: number) => labels[v] }, i)) };
    };
    const top = draw(dimension({ name: 'month', type: 'time', granularity: 'month' }));
    const inInputs = draw(dimension({ name: 'month', type: 'time', inputs: { granularity: 'month' } }));
    const chartProp = draw(dimension({ name: 'month', type: 'time' }), 'month');

    expect(top.labels).toHaveLength(3); // February filled in
    expect(top.shown).toEqual(['Jan 2026', 'Feb 2026', 'Mar 2026']);
    expect(inInputs).toEqual(top);
    expect(chartProp.labels).toHaveLength(2);
    expect(chartProp.shown).not.toEqual(top.shown.filter((_, i) => i !== 1));
  });

  // The charts that take `granularity` beside a time field; the granularity select's own is its value.
  it.each(each.filter(([, e]) => e.group !== 'Controls' && propsOf(e).some((p) => p.name === 'granularity')))(
    '%s says which granularity does what',
    (_, entry) => {
      const note = propDescription(propsOf(entry).find((p) => p.name === 'granularity')!, entry);
      expect(note).toContain('date range a click reports');
      expect(note).toContain('The axis labels and the gap filling come from the time field');
    },
  );
});

// ---- G2: field option defaults ------------------------------------------------

type OptionRow = { component: ChartEntry; option: string; printed: string; fields: string[] };
const optionRows: OptionRow[] = chartEntries.flatMap((entry) => {
  const byOption = new Map<string, OptionRow>();
  for (const [fieldName, field] of Object.entries(componentFieldOptions[nameOf(entry)] ?? {})) {
    for (const option of field.inputs) {
      const printed = fieldOptionDefault(option);
      if (!printed) continue;
      const row = byOption.get(option.name) ?? { component: entry, option: option.name, printed, fields: [] };
      row.fields.push(fieldName);
      byOption.set(option.name, row);
    }
  }
  return [...byOption.values()];
});

describe('field option defaults', () => {
  it('cover the options the review found wrong', () => {
    const printed = (component: string, option: string) =>
      optionRows.find((row) => nameOf(row.component) === component && row.option === option)?.printed;
    expect(printed('LineChart', 'connectGaps')).toBe('false');
    expect(printed('LineChartComparison', 'previousLineDashed')).toBe('false');
    expect(printed('LineChartComparisonWithKpiTabs', 'percentageDecimalPlaces')).toBe('1');
    expect(optionRows.length).toBeGreaterThan(30);
  });

  it.each(optionRows.map((row) => [`${nameOf(row.component)} ${row.option} = ${row.printed}`, row] as const))(
    '%s: the chart is the same with the option left out',
    (_, { component, option, printed, fields }) => {
      const props = propsWithAGap(component);
      const set = (value: unknown) => (inputs: Record<string, unknown>) => {
        const { [option]: _dropped, ...rest } = inputs;
        return value === undefined ? rest : { ...rest, [option]: value };
      };
      // Once as the example has it, and once with the field's other switches
      // on, for an option that only counts beside another
      // (percentageDecimalPlaces needs displayChangeAsPercentage).
      const switchedOn = withInputs(props, fields, (inputs) => {
        for (const other of componentFieldOptions[nameOf(component)]![fields[0]!]!.inputs) {
          if (other.type === 'boolean' && other.name !== option && other.name !== 'showGranularityDropdown') inputs[other.name] = true;
        }
        return inputs;
      });
      for (const context of [props, switchedOn]) {
        const unset = fingerprint(component, withInputs(context, fields, set(undefined)));
        const atDefault = fingerprint(component, withInputs(context, fields, set(JSON.parse(printed))));
        expect(atDefault, `${option}: ${printed} is not what the package does when it is left out`).toBe(unset);
      }
    },
  );

  it('the review’s case: a gap breaks the line unless connectGaps is set', () => {
    const entry = chartEntries.find((e) => e.id === 'line')!;
    const props = propsWithAGap(entry);
    const unset = fingerprint(entry, withInputs(props, ['measures'], ({ connectGaps: _c, ...rest }) => rest));
    const on = fingerprint(entry, withInputs(props, ['measures'], (inputs) => ({ ...inputs, connectGaps: true })));
    expect(on).not.toBe(unset);
  });
});

// ---- G8: what the reference leaves out, because the code ignores it ------------

describe('ignored props and options', () => {
  const nonDefault = (type: string, current: unknown): unknown =>
    type === 'boolean' ? !current : type === 'number' ? 2 : type === 'string' ? 'Other' : { isLoading: false, data: [{ x: 1 }] };

  it.each(each.filter(([, e]) => ignoredProps(nameOf(e)).length > 0))('%s: each ignored prop changes nothing', (_, entry) => {
    const props = buildChart(entry, settings, runtime).props;
    for (const name of ignoredProps(nameOf(entry))) {
      const doc = componentProps[nameOf(entry)]!.find((p) => p.name === name);
      expect(doc, `${name} is not a prop of ${nameOf(entry)}`).toBeDefined();
      const { [name]: current, ...without } = props;
      const value = typeof current === 'function' || doc!.type.includes('=>') ? () => {} : nonDefault(doc!.type, current);
      expect(fingerprint(entry, { ...without, [name]: value }), name).toBe(fingerprint(entry, without));
      // Left out of the table, and named once instead.
      expect(propsOf(entry).map((p) => p.name)).not.toContain(name);
      expect(markdownOf.get(entry.id)).toContain(`Not listed: `);
    }
  });

  it.each(each.filter(([, e]) => ignoredFieldOptions(nameOf(e)).length > 0))('%s: each ignored field option changes nothing', (_, entry) => {
    const props = buildChart(entry, settings, runtime).props;
    const fields = Object.keys(componentFieldOptions[nameOf(entry)] ?? {});
    for (const option of ignoredFieldOptions(nameOf(entry))) {
      for (const value of [true, false]) {
        expect(fingerprint(entry, withInputs(props, fields, (inputs) => ({ ...inputs, [option]: value }))), option).toBe(fingerprint(entry, props));
      }
      expect(markdownOf.get(entry.id)).not.toContain(`| \`${option}\` |`);
    }
  });

  it('maxLegendItems is not documented where the chart does not read it', () => {
    expect(markdownOf.get('bar-stacked')).not.toContain('| `maxLegendItems` |');
    expect(markdownOf.get('bar-stacked')).not.toContain('Not read by this chart');
  });
});

// ---- D7: the defaults the props table shows ---------------------------------------

describe('defaults the props table shows', () => {
  // A default from the component sources rather than componentDefaults: leaving
  // the prop out draws exactly what passing the default does, and passing the
  // other value does not.
  it.each(each.filter(([, e]) => propsOf(e).some((p) => p.name in codeDefaults)))('%s: leaving a prop out is passing its default', (_, entry) => {
    const props = buildChart(entry, settings, runtime).props;
    for (const name of Object.keys(codeDefaults).filter((n) => propsOf(entry).some((p) => p.name === n))) {
      const { [name]: _given, ...without } = props;
      expect(propDefault(entry, propsOf(entry).find((p) => p.name === name)!)).toBe(JSON.stringify(codeDefaults[name]));
      expect(fingerprint(entry, without), name).toBe(fingerprint(entry, { ...without, [name]: codeDefaults[name] }));
      if (name === 'hideMenu') expect(fingerprint(entry, without), name).not.toBe(fingerprint(entry, { ...without, [name]: true }));
    }
  });

  it('a blank default is unset, which can differ from false: reverseTrendDirection follows the colours until set', () => {
    const entry = chartEntries.find((e) => e.id === 'kpi-comparison')!;
    const prop = propsOf(entry).find((p) => p.name === 'reverseTrendDirection')!;
    expect(propDefault(entry, prop)).toBe('');
    const props: Record<string, unknown> = { ...buildChart(entry, settings, runtime).props, reversePositiveNegativeColors: true };
    const { reverseTrendDirection: _given, ...unset } = props;
    expect(fingerprint(entry, unset)).not.toBe(fingerprint(entry, { ...unset, reverseTrendDirection: false }));
    expect(fingerprint(entry, unset)).toBe(fingerprint(entry, { ...unset, reverseTrendDirection: true }));
  });
});

// ---- D6: the keyboard tables -------------------------------------------------------

describe('keyboard tables', () => {
  const rendered = (id: string, extra: Record<string, unknown> = {}) => {
    const entry = chartEntries.find((e) => e.id === id)!;
    const props = { ...buildChart(entry, settings, runtime).props, ...extra };
    const Component = getComponent(entry);
    return mount(
      <div style={{ height: 400 }}>
        <Component {...props} />
      </div>,
    );
  };
  const says = (id: string, text: string) => JSON.stringify(keyboardRows(chartEntries.find((e) => e.id === id)!)).includes(text);

  it('paginated table: a sort button in each column header, page buttons and a copy button per cell', () => {
    const { container, unmount } = rendered('table');
    const headers = [...container.querySelectorAll('thead th[aria-sort]')];
    expect(headers.length).toBeGreaterThan(0);
    for (const th of headers) expect(th.querySelector('button')).not.toBeNull();
    for (const label of ['First page', 'Previous page', 'Next page', 'Last page']) {
      expect(container.querySelector(`button[aria-label="${label}"]`), label).not.toBeNull();
    }
    expect(container.querySelectorAll('tbody td button[title^="Copy"]').length).toBeGreaterThan(0);
    expect(says('table', 'Page button') && says('table', 'Column header') && says('table', 'Copy button')).toBe(true);
    unmount();
  });

  it('scrollable table: sort buttons and copy buttons, and no page buttons', () => {
    const { container, unmount } = rendered('table-scrollable');
    expect(container.querySelectorAll('thead th[aria-sort] button').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('tbody td button[title^="Copy"]').length).toBeGreaterThan(0);
    expect(container.querySelector('button[aria-label="Next page"]')).toBeNull();
    expect(says('table-scrollable', 'Page button')).toBe(false);
    unmount();
  });

  it('pivot table: nothing takes focus without sub-rows; with them, each row header opens', () => {
    const plain = rendered('pivot');
    expect(plain.container.querySelectorAll('table [tabindex], table [role="button"]').length).toBe(0);
    plain.unmount();
    const entry = chartEntries.find((e) => e.id === 'pivot')!;
    const field = (buildChart(entry, settings, runtime).props.columnDimension as object);
    const nested = rendered('pivot', { subRowDimension: field });
    const heads = [...nested.container.querySelectorAll('tbody th[role="button"]')];
    expect(heads.length).toBeGreaterThan(0);
    for (const th of heads) {
      expect(th.getAttribute('tabindex')).toBe('0');
      expect(th.getAttribute('aria-expanded')).toBe('false');
    }
    nested.unmount();
    expect(says('pivot', 'subRowDimension')).toBe(true);
  });

  it('heat map: every cell takes focus, and Enter calls onCellClicked', () => {
    const onCellClicked = vi.fn();
    const { container, unmount } = rendered('heatmap', { onCellClicked });
    const cells = [...container.querySelectorAll('tbody td')];
    expect(cells.length).toBeGreaterThan(0);
    for (const td of cells) {
      expect(td.getAttribute('role')).toBe('button');
      expect(td.getAttribute('tabindex')).toBe('0');
    }
    act(() => cells[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onCellClicked).toHaveBeenCalledTimes(1);
    unmount();
  });
});

// ---- G7: closed sets --------------------------------------------------------

describe('closed sets', () => {
  it('lists every comparison period the package knows, and only those', () => {
    expect(COMPARISON_PERIODS).toEqual(defaultComparisonPeriodOptions.map((option) => option.value));
    expect(GRANULARITIES.map((g) => `"${g}"`).join(' | ')).toBe(typeDefinitions.Granularity);
  });

  it.each(each)('%s spells out every closed set it uses', (_, entry) => {
    const markdown = markdownOf.get(entry.id)!;
    const props = propsOf(entry);
    if (props.some((p) => p.name === 'comparisonPeriod')) {
      const note = propDescription(props.find((p) => p.name === 'comparisonPeriod')!, entry);
      for (const period of COMPARISON_PERIODS) expect(note).toContain(`\`"${period}"\``);
    }
    if (props.some((p) => p.name === 'granularity')) {
      expect(markdown).toContain(`type Granularity = ${typeDefinitions.Granularity}`);
    }
    if (props.some((p) => /\bTimeRange\b/.test(propType(p)) || /\bTimeRange\b/.test(p.payload ?? ''))) {
      // As the package declares it, with what that means when you read one and when you write one.
      expect(markdown).toContain(`type TimeRange = ${typeDefinitions.TimeRange}`);
      expect(markdown).toContain('is `undefined` unless the clicked field is a time dimension');
      expect(markdown).toContain('When you pass one, `from` and `to` are enough.');
    }
    for (const prop of props.filter((p) => /DateRange$/.test(p.name) && p.name !== 'setComparisonDateRange')) {
      expect(propDescription(prop, entry)).toContain('`{ from: Date, to: Date }`');
    }
  });
});

// ---- G6: type names ----------------------------------------------------------

// The package's exports, as a caller can import them.
const config = ts.getParsedCommandLineOfConfigFile(`${process.cwd()}/tsconfig.json`, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: () => {},
})!;
const program = ts.createProgram([`${process.cwd()}/src/index.ts`], { ...config.options, noEmit: true });
const checker = program.getTypeChecker();
const exported = new Set(
  checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(`${process.cwd()}/src/index.ts`)!)!).map((s) => s.name),
);
// Names TypeScript and React define, which every reader already has.
const GLOBAL_TYPES = new Set(['Date', 'Record', 'Partial', 'Array', 'SetStateAction']);
const typeNames = (text: string) => [...text.matchAll(/\b[A-Z][A-Za-z0-9]*\b/g)].map((m) => m[0]);

describe('type names', () => {
  it.each(each)('%s: every type name in the props table is exported or defined on the page', (_, entry) => {
    const markdown = markdownOf.get(entry.id)!;
    const table = markdown.split('## Props')[1]!.split('## Field options')[0]!;
    const defined = new Set([...table.matchAll(/^type (\w+) =/gm)].map((m) => m[1]!));
    const cells = table
      .split('\n')
      .filter((line) => line.startsWith('| `'))
      .map((line) => line.split(/(?<!\\)\|/)[2]!);
    const blocks = [...table.matchAll(/^type \w+ = (.*)$/gm)].map((m) => m[1]!);
    const unknown = [...cells, ...blocks]
      .flatMap(typeNames)
      .filter((name) => !GLOBAL_TYPES.has(name) && !exported.has(name) && !defined.has(name));
    expect([...new Set(unknown)]).toEqual([]);
    // What the page tells a reader to import is there to import.
    for (const shape of typeShapes(entry)) expect(exported, shape).toContain(shape.split(' = ')[0]);
  });

  it.each(each)('%s: the HTML page names no type it leaves undefined', (_, entry) => {
    const html = renderToString(
      <SiteSettingsProvider>
        <ComponentDocPage entry={entry} route={componentPath(entry.id)} />
      </SiteSettingsProvider>,
    );
    const page = document.createElement('div');
    page.innerHTML = html;
    // Quoted values ('Bold', "csv") are values, not type names.
    const types = [...page.querySelectorAll('.api-table__type, .api-table__payload')].map((el) =>
      (el.textContent ?? '').replace(/'[^']*'|"[^"]*"/g, ''),
    );
    const unknown = types
      .flatMap((text) => typeNames(text.replace(/^\w+ = /, '')))
      .filter((name) => !GLOBAL_TYPES.has(name) && !exported.has(name));
    expect([...new Set(unknown)]).toEqual([]);
  });
});

// ---- G8: prose against the code beside it ----------------------------------------

describe('notes and the code beside them', () => {
  // A prop or field option named in a note is in the code under it, or the
  // note says the code leaves it out on purpose: it is the default, optional,
  // or what happens unless it is set.
  it.each(each)('%s names no prop its code does not show', (_, entry) => {
    const names = new Set([
      ...(componentProps[nameOf(entry)] ?? []).map((p) => p.name),
      ...Object.values(componentFieldOptions[nameOf(entry)] ?? {}).flatMap((f) => f.inputs.map((o) => o.name)),
    ]);
    componentExamples(entry).forEach((example, index) => {
      const code = exampleCode(entry, example, base);
      const text = (index === 0 ? [purposeOf(entry), ...notesOf(entry)] : [example.description, ...(example.notes ?? [])])
        .concat(defaultsNote(entry, example))
        .join(' ');
      const sentences = sentencesOf(text);
      for (const name of new Set([...text.matchAll(/`([A-Za-z]\w*)/g)].map((m) => m[1]!))) {
        if (!names.has(name) || new RegExp(`\\b${name}\\b`).test(code)) continue;
        const explained = sentences.some((s) => s.includes(`\`${name}`) && /\bdefault\b|\boptional\b|\bunless\b/.test(s));
        expect(explained, `${entry.id} / ${example.id}: \`${name}\` is named but not in the code:\n${text}`).toBe(true);
      }
    });
  });

  it('the usage examples show the components’ own defaults', () => {
    const usage = (id: string) => exampleCode(chartEntries.find((e) => e.id === id)!, componentExamples(chartEntries.find((e) => e.id === id)!)[0]!, base);
    expect(usage('line-comparison')).not.toContain('showComparisonAxis');
    expect(usage('line-comparison-with-kpi-tabs')).not.toContain('showComparisonAxis');
    expect(usage('kpi-comparison')).not.toContain('displayChangeAsPercentage');
  });

  it('prints a resetKey that means something in a reader’s app', () => {
    const entry = chartEntries.find((e) => e.id === 'table-scrollable')!;
    for (const example of componentExamples(entry)) {
      const code = exampleCode(entry, example, base);
      expect(code).toContain('resetKey={filters}');
      expect(code).not.toMatch(/dataset: '/);
    }
  });
});

// ---- Time as the grouping field ------------------------------------------------------

// The time series guide (#grouping-by-time): a stacked bar chart reads a time
// groupBy from `name.<granularity>`, and a grouped line chart from `name`.
describe('time as the grouping field', () => {
  it('the row-key rule says what the charts read', () => {
    const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });
    const quarter = dimension({ name: 'quarter', title: 'Quarter' });
    const revenue = measure({ name: 'revenue', title: 'Revenue' });
    const groupsOf = (element: React.ReactElement) => {
      drawn.length = 0;
      const { unmount } = mount(<div style={{ height: 400 }}>{element}</div>);
      unmount();
      return ((drawn.at(-1)?.data as { datasets: { rawLabel?: unknown }[] }) ?? { datasets: [] }).datasets.map((d) => d.rawLabel);
    };
    const plain = [{ quarter: 'Q1', month: '2026-01-01T00:00:00.000', revenue: 1 }];
    const keyed = [{ quarter: 'Q1', 'month.month': '2026-01-01T00:00:00.000', revenue: 1 }];
    // BarChartStacked reads a time groupBy from `name.<granularity>`.
    expect(groupsOf(<BarChartStacked xAxis={quarter} groupBy={month} measure={revenue} results={results(keyed)} />)).toEqual(['2026-01-01T00:00:00.000']);
    expect(groupsOf(<BarChartStacked xAxis={quarter} groupBy={month} measure={revenue} results={results(plain)} />)).not.toContain('2026-01-01T00:00:00.000');
    // LineChartGrouped reads it from `name`.
    expect(groupsOf(<LineChartGrouped xAxis={dimension({ name: 'quarter', type: 'time', granularity: 'quarter' })} groupBy={month} measure={revenue} results={results([{ quarter: '2026-01-01T00:00:00.000', month: '2026-01-01T00:00:00.000', revenue: 1 }])} />)).toContain('2026-01-01T00:00:00.000');
  });
});

// ---- C1: the card menu ----------------------------------------------------------

// The live preview's own wiring: the table state in useState, as useChart keeps it.
const Preview = ({ entry, drop }: { entry: ChartEntry; drop?: string }) => {
  const [tableState, setTableState] = useState<TableState>({ page: 0, isLoadingDownloadData: false });
  const { props } = buildChart(entry, settings, { ...runtime, tableState, setTableState });
  const { [drop ?? '']: _dropped, ...rest } = props;
  return <div style={{ height: 400 }}>{createElement(getComponent(entry), drop ? rest : props)}</div>;
};

const downloads: Blob[] = [];
const waitFor = async (check: () => boolean, ms: number) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (check()) return true;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  return check();
};

/** Opens the card menu from the keyboard, picks an entry, and reports whether the menu stopped loading. */
const choose = async (container: HTMLElement, label: string, ms = 3000) => {
  const trigger = () => container.querySelector<HTMLElement>('[data-no-export] [aria-haspopup="menu"]');
  // While a download is running the trigger is a spinner, not a button.
  const ready = () => trigger()?.tagName === 'BUTTON';
  expect(ready()).toBe(true);
  act(() => {
    trigger()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((el) => el.textContent === label);
  expect(item, `no "${label}" in the menu`).toBeDefined();
  act(() => item!.click());
  return waitFor(ready, ms);
};

describe('card menu downloads', () => {
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;
  const realClick = HTMLAnchorElement.prototype.click;
  beforeAll(() => {
    URL.createObjectURL = (blob: Blob) => {
      downloads.push(blob);
      return 'blob:download';
    };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = () => {};
  });
  afterAll(() => {
    URL.createObjectURL = realCreate;
    URL.revokeObjectURL = realRevoke;
    HTMLAnchorElement.prototype.click = realClick;
  });

  const labels: Record<string, string> = { csv: 'Download CSV', xlsx: 'Download XLSX', png: 'Download PNG' };

  // The components with a card menu: every chart and table, and no control.
  const menus = componentDefaults as unknown as Record<string, { menuOptions?: string[] }>;
  const withMenu = each.filter(([, entry]) => menus[nameOf(entry)]?.menuOptions);

  it('every chart and table has a card menu', () => {
    expect(each.filter(([, entry]) => !menus[nameOf(entry)]?.menuOptions).map(([, entry]) => entry.group)).toEqual(
      each.filter(([, entry]) => entry.group === 'Controls').map(() => 'Controls'),
    );
  });

  it.each(withMenu)('%s: every download in the default menu finishes', async (_, entry) => {
    const options = ((buildChart(entry, settings, runtime).props.menuOptions ?? menus[nameOf(entry)]!.menuOptions) as string[]).filter(
      (o) => o in labels,
    );
    const { container, unmount } = mount(<Preview entry={entry} />);
    for (const option of options) {
      downloads.length = 0;
      expect(await choose(container, labels[option]!), `${option} never finished`).toBe(true);
      expect(downloads.length, `${option} downloaded nothing`).toBe(1);
    }
    // A table's CSV holds every row, not the page on screen.
    const all = buildChart(entry, settings, runtime).props.allResults as { data: unknown[] } | undefined;
    if (all && options.includes('csv')) {
      downloads.length = 0;
      await choose(container, labels.csv!);
      const lines = (await downloads[0]!.text()).split('\r\n');
      expect(lines.length).toBe(all.data.length + 1);
    }
    unmount();
  }, 20000);

  it('without allResults a table’s download never finishes, which is why every example passes it', async () => {
    const entry = chartEntries.find((e) => e.id === 'table')!;
    const { container, unmount } = mount(<Preview entry={entry} drop="allResults" />);
    expect(await choose(container, 'Download CSV', 600)).toBe(false);
    unmount();
    for (const id of ['table', 'table-scrollable']) {
      const table = chartEntries.find((e) => e.id === id)!;
      for (const example of componentExamples(table)) expect(exampleCode(table, example, base)).toContain('allResults=');
    }
  });
});

// ---- Round 3: axis order, value axes, table height ----------------------------------

describe('what the pages say about axes and heights', () => {
  const plan = dimension({ name: 'plan', title: 'Plan' });
  const month = dimension({ name: 'month', title: 'Month' });
  const revenue = measure({ name: 'revenue', title: 'Revenue' });
  // Out of alphabetical order, the way a query sorted by revenue returns them.
  const rows = [
    { plan: 'Starter', month: 'Jan', revenue: 120 },
    { plan: 'Growth', month: 'Jan', revenue: 150 },
    { plan: 'Enterprise', month: 'Jan', revenue: 180 },
  ];
  const draw = (element: React.ReactElement) => {
    drawn.length = 0;
    const { unmount } = mount(<div style={{ height: 400 }}>{element}</div>);
    unmount();
    return drawn.at(-1)!;
  };

  it.each(each.filter(([, e]) => axisOrderNote(e)))('%s draws its axis A to Z unless axisOrder is passed, as its note says', (_, entry) => {
    const axis = axisOrderNote(entry).includes('`yAxis`') ? 'yAxis' : 'xAxis';
    const props = { [axis]: plan, groupBy: month, measure: revenue, results: results(rows) };
    const labels = (extra: object) => (draw(createElement(getComponent(entry), { ...props, ...extra })).data as { labels: unknown[] }).labels;
    expect(labels({})).toEqual(['Enterprise', 'Growth', 'Starter']);
    expect(labels({ axisOrder: ['Starter', 'Growth', 'Enterprise'] })).toEqual(['Starter', 'Growth', 'Enterprise']);
    expect(notesOf(entry)).toContain(axisOrderNote(entry));
  });

  it('BarChart keeps the rows’ order, so it has no such note', () => {
    const entry = chartEntries.find((e) => nameOf(e) === 'BarChart')!;
    expect(axisOrderNote(entry)).toBe('');
    expect((draw(<BarChart dimension={plan} measures={[revenue]} results={results(rows)} />).data as { labels: unknown[] }).labels).toEqual([
      'Starter',
      'Growth',
      'Enterprise',
    ]);
  });

  it('bar and line charts start the value axis at zero when the range is unset; a scatter chart fits the data', () => {
    const y = (chart: { options: unknown }) => (chart.options as { scales: { y: { beginAtZero?: boolean; min?: number } } }).scales.y;
    expect(y(draw(<BarChart dimension={plan} measures={[revenue]} results={results(rows)} />)).beginAtZero).toBe(true);
    expect(y(draw(<LineChart xAxis={plan} measures={[revenue]} results={results(rows)} />)).beginAtZero).toBe(true);
    const cost = measure({ name: 'cost', title: 'Cost' });
    const points = rows.map((row, i) => ({ ...row, cost: 50 + i }));
    expect(y(draw(<ScatterChart xMeasure={cost} yMeasure={revenue} pointDimension={plan} results={results(points)} />)).beginAtZero).toBeFalsy();
    for (const entry of chartEntries) {
      for (const prop of propsOf(entry).filter((p) => /AxisRange(Min|Max)$/.test(p.name))) {
        expect(propDescription(prop, entry), `${nameOf(entry)} ${prop.name}`).not.toContain('The default fits the data');
      }
    }
  });

  it('TableScrollable is "fixed" when heightMode is left out, as its props table says', () => {
    const entry = chartEntries.find((e) => nameOf(e) === 'TableScrollable')!;
    expect(propDefault(entry, propsOf(entry).find((p) => p.name === 'heightMode')!)).toBe('"fixed"');
    const html = (extra: object) => {
      const { container, unmount } = mount(
        <div style={{ height: 400 }}>
          <TableScrollable dimensionsAndMeasures={[plan, revenue]} results={results(rows)} {...extra} />
        </div>,
      );
      const markup = container.innerHTML.replace(/\bid="[^"]*"|aria-(labelledby|controls|describedby)="[^"]*"/g, '');
      unmount();
      return markup;
    };
    expect(html({})).toBe(html({ heightMode: 'fixed' }));
    // Only "auto" grows the card: the table's own test of the mode.
    expect([isAutoHeight(undefined), isAutoHeight('fixed'), isAutoHeight('auto')]).toEqual([false, false, true]);
  });
});
