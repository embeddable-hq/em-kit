import { componentDefaults } from '../../src/componentDefaults.generated';
// From its own module: the package's index would bring in every component.
import { TABLE_SCROLLABLE_SIZE } from '../../src/generated/components/charts/tables/TableScrollable/TableScrollable.utils';
import { buildChart, ChartRuntime, ChartSettings } from '../catalog/build';
import {
  COMMON_FIELD_OPTIONS,
  fieldOptionDefault,
  fieldOptionNote,
  fieldOptionType,
  FIELD_OPTIONS_PATH,
  specificFieldOptions,
  timeFieldOptions,
} from '../catalog/fieldOptionNotes';
import { codeDefaults, ignoredProps, propNote } from '../catalog/propNotes';
import { ChartEntry, chartEntries, chartGroups, DataState } from '../catalog/registry';
import { DEFAULT_THEME_ID } from '../catalog/themes';
import { installCommand, installMarkdown, packageManagers } from '../components/InstallCommand';
import { BRAND } from '../config';
import { componentFieldOptions, componentProps, PropDoc, typeDefinitions } from '../generated/props';
import { MEASURE_VALUE_UNSET, MEASURE_VALUES_HANDLERS, TIME_RANGE_NOTE } from './clickPayloads';
import { markdownLink } from './guides';
import { componentPath, playgroundPath } from './routes';
import pivotSubRowsModule from '../examples/PivotSubRows.tsx?raw';

// Everything a component's docs page says, derived from the registry and the
// generated props so it can't drift from the code: its examples, its props,
// its Markdown twin (Copy page as Markdown, <page>.md) and its agent prompt.

const pkg = BRAND.packageName;
const exportOf = (entry: ChartEntry) => String(entry.exportName);

export type ComponentExample = {
  id: string;
  /** Short title: what this example shows, without the component's name. */
  name: string;
  /** One sentence: what the reader sees. */
  description: string;
  /** How it is done, prop by prop. In the Markdown twin; the page shows the code. */
  notes?: string[];
  variantId?: string;
  dataState: DataState;
  /** Prop values layered over the entry's own, as the playground does. */
  overrides?: Record<string, unknown>;
};

/**
 * An example written by hand, for what the generated ones cannot show (a
 * controlled flow across renders): a whole module in site/examples, type-checked
 * with the site, rendered live on the page and printed in the twin.
 */
export type WrittenExample = { id: string; name: string; description: string; notes: string[]; file: string; code: string };

const asPackage = (source: string) => source.replace(/from '\.\.\/\.\.\/src'/g, `from '${BRAND.packageName}'`).trim();

// The pivot table's sub-rows (PivotTablePro upstream): the table calls
// setExpandedRowKey once per row, the first time it is opened and only while
// it has no sub-rows; it matches sub-rows by `String(row[rowDimension.name])`
// against the keys in expandedRowKeys, and collapses rows on its own.
// tests/payloads.test.tsx opens a row of this example to hold it to that.
const writtenExamples: Record<string, WrittenExample[]> = {
  PivotTable: [
    {
      id: 'sub-rows',
      name: 'Sub-rows on demand',
      description: 'Each region opens to its countries, loaded the first time it is opened.',
      notes: [
        '`setExpandedRowKey` is called with a row’s `rowDimension` value the first time it is opened: add it to `expandedRowKeys` and load `resultsSubRows`, whose rows carry the `rowDimension`, `subRowDimension` and `columnDimension` values and the measures.',
      ],
      file: 'PivotSubRows.tsx',
      code: asPackage(pivotSubRowsModule),
    },
  ],
};

/** The hand-written examples a component's page shows after its generated ones. */
export const writtenExamplesOf = (entry: ChartEntry): WrittenExample[] => writtenExamples[exportOf(entry)] ?? [];

/** The states of `results` a chart draws for itself, in the order the preview's switch lists them. */
export const dataStates: { id: DataState; label: string; hint: string }[] = [
  { id: 'ready', label: 'Data', hint: '' },
  { id: 'loading', label: 'Loading', hint: 'Shown while `results.isLoading` is true.' },
  { id: 'empty', label: 'Empty', hint: 'Shown when `results.data` is an empty array.' },
  { id: 'error', label: 'Error', hint: 'Shown when `results.error` is set, with its text.' },
];

// Where a required prop sits among the others: the fields first, in the order
// you would say them (axis, split, value), then the data.
const AXIS_FIRST = ['dimension', 'xAxis', 'yAxis', 'rowDimension', 'columnDimension'];
const requiredRank = (entry: ChartEntry, name: string) => {
  const field = componentFieldOptions[exportOf(entry)]?.[name];
  if (!field) return 30;
  if (field.kind !== 'dimension') return 20;
  if (name === 'groupBy') return 11;
  return AXIS_FIRST.includes(name) ? AXIS_FIRST.indexOf(name) : 10;
};

/**
 * Required props first (fields, then data), then the rest in the order the
 * types declare them. A prop the component's type declares and its code never
 * reads is left out (see `ignoredProps`).
 */
export const propsOf = (entry: ChartEntry): PropDoc[] => {
  const ignored = ignoredProps(exportOf(entry));
  const props = (componentProps[exportOf(entry)] ?? []).filter((p) => !ignored.includes(p.name));
  const required = props.filter((p) => p.required).sort((a, b) => requiredRank(entry, a.name) - requiredRank(entry, b.name));
  return [...required, ...props.filter((p) => !p.required)];
};

export const requiredProps = (entry: ChartEntry): string[] =>
  propsOf(entry)
    .filter((p) => p.required)
    .map((p) => p.name);

const has = (props: PropDoc[], name: string) => props.some((p) => p.name === name);

// "Bar chart · monthly columns" on the gallery card reads as "Monthly columns"
// under the Bar chart page's own heading.
const shortName = (entry: ChartEntry, name: string) => {
  const short = name.startsWith(`${entry.name} · `) ? name.slice(entry.name.length + 3) : name;
  return short.charAt(0).toUpperCase() + short.slice(1);
};

/** The default example (the page's usage code), then one per preset, basic to advanced. */
export const componentExamples = (entry: ChartEntry): ComponentExample[] => [
  { id: 'usage', name: entry.name, description: purposeOf(entry), dataState: 'ready' },
  ...(entry.variants ?? []).map((v) => ({
    id: v.id,
    name: shortName(entry, v.name),
    description: v.description,
    notes: v.notes,
    variantId: v.id,
    dataState: 'ready' as const,
  })),
];

const noop = () => {};
const staticRuntime: ChartRuntime = {
  granularity: 'month',
  setGranularity: noop,
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: noop,
  onEvent: noop,
};

const list = (items: string[], last = 'and') =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${last} ${items[items.length - 1]}`;
const code = (name: string) => `\`${name}\``;

const defaultsOf = (entry: ChartEntry) =>
  (componentDefaults as Record<string, Record<string, unknown>>)[exportOf(entry)] ?? {};

const propsFor = (entry: ChartEntry, example: ComponentExample) =>
  buildChart(
    entry,
    {
      themeId: 'default',
      languageId: 'en',
      datasetId: 'saas',
      toggles: {},
      dataState: 'ready',
      variantId: example.variantId,
      overrides: example.overrides,
    },
    staticRuntime,
  ).props;

/**
 * Why an example's code is missing a prop its text is about: the example puts
 * back a default that the usage example overrides, and printed code leaves
 * defaults out. Empty when that is not the case.
 */
export const defaultsNote = (entry: ChartEntry, example: ComponentExample): string => {
  if (!example.variantId && !example.overrides) return '';
  const defaults = defaultsOf(entry);
  const usage = propsFor(entry, componentExamples(entry)[0]!);
  const own = propsFor(entry, example);
  const value = (props: Record<string, unknown>, key: string) => JSON.stringify(props[key] ?? defaults[key]);
  const back = Object.keys(defaults).filter(
    (key) => value(usage, key) !== JSON.stringify(defaults[key]) && value(own, key) === JSON.stringify(defaults[key]),
  );
  if (!back.length) return '';
  return `Unlike the usage example, this code keeps the default ${list(back.map(code))} (${list(back.map((key) => code(JSON.stringify(defaults[key]))))}).`;
};

type CodeBase = Pick<ChartSettings, 'themeId' | 'languageId' | 'datasetId'>;

const builtExample = (entry: ChartEntry, example: ComponentExample, base: CodeBase) =>
  buildChart(
    entry,
    {
      ...base,
      toggles: {},
      dataState: example.dataState,
      variantId: example.variantId,
      overrides: example.overrides,
      omitHandlers: true,
    },
    staticRuntime,
  );

/** An example's complete module, as Copy, the Markdown twin and the prompt give it. */
export const exampleCode = (entry: ChartEntry, example: ComponentExample, base: CodeBase) =>
  builtExample(entry, example, base).code;

/** Code with some of its lines highlighted (0-based). */
export type MarkedCode = { code: string; marked: number[] };

/** How a page shows an example: the whole module, and for every example after the first, an excerpt. */
export type ExampleView = MarkedCode & { excerpt?: MarkedCode };

/** An excerpt is held to this many lines where the parts that differ allow. */
export const EXCERPT_LINES = 25;

// The lines of `lines` that are not in `before`, by a longest common subsequence.
const changedLines = (lines: string[], before: string[]): Set<number> => {
  const n = lines.length;
  const m = before.length;
  const common = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      common[i]![j] = lines[i] === before[j] ? common[i + 1]![j + 1]! + 1 : Math.max(common[i + 1]![j]!, common[i]![j + 1]!);
    }
  }
  const changed = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n) {
    if (j < m && lines[i] === before[j]) {
      i++;
      j++;
    } else if (j < m && common[i]![j + 1]! > common[i + 1]![j]!) j++;
    else changed.add(i++);
  }
  return changed;
};

const dedent = (lines: string[]) => {
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent));
};

/** The line an excerpt gives a helper it calls and does not show. */
export const helperComment = (name: string, params: string) => `// ${name}(${params}): in the full code.`;

/**
 * An example as its page shows it. The usage example is shown whole. Every
 * other is shown as an excerpt: the declarations, rows and component code that
 * differ from the usage example's, and the component's element for context,
 * with the lines that differ highlighted. The whole module stays a click away
 * and is what Copy copies; it carries the same highlights.
 */
export const exampleView = (entry: ChartEntry, example: ComponentExample, base: CodeBase): ExampleView => {
  const built = builtExample(entry, example, base);
  const usage = componentExamples(entry)[0]!;
  if (example.id === usage.id) return { code: built.code, marked: [] };
  const before = new Map(builtExample(entry, usage, base).parts.map((part) => [part.key, part.lines]));

  // Highlights over the whole module, part by part.
  // The JSX around the element counts where it differs: a sized wrapper
  // (`width: 320`) is what a "small card" example is about.
  const marks = built.parts.map((part) => {
    if (part.kind === 'wrapper' && part.key !== 'jsx-open') return new Set<number>();
    if (part.key === 'jsx-open') {
      // Its tags, compared without their indent (a component with state returns its JSX one level deeper).
      const trim = (lines: string[] = []) => lines.map((line) => line.trim());
      const changed = changedLines(trim(part.lines), trim(before.get(part.key)));
      return new Set([...changed].filter((i) => part.lines[i]!.trim().startsWith('<')));
    }
    const old = before.get(part.key);
    const changed = old ? changedLines(part.lines, old) : new Set(part.lines.keys());
    return new Set([...changed].filter((i) => part.lines[i]!.trim()));
  });
  const marked: number[] = [];
  let offset = 0;
  built.parts.forEach((part, p) => {
    for (const i of marks[p]!) marked.push(offset + i);
    offset += part.lines.length;
  });

  // The excerpt: the element always, and the declarations and component code
  // that changed. Sample rows are data, not the feature, so they stay in the
  // full code unless they are a one-line total. Unchanged declarations come in
  // as context when the excerpt would otherwise be very short.
  const indexed = built.parts.map((part, p) => ({ part, p, changed: marks[p]!.size > 0 }));
  const chosen = new Set<number>();
  const size = () => [...chosen].reduce((n, p) => n + built.parts[p]!.lines.length + 1, -1);
  for (const { part, p, changed } of indexed) {
    const total = part.kind === 'rows' && part.lines.length === 1;
    if (part.kind === 'element' || (changed && (part.kind === 'declaration' || part.kind === 'body' || total))) chosen.add(p);
  }
  if (size() < 10) {
    for (const { part, p } of indexed) {
      if (part.kind !== 'declaration' || chosen.has(p)) continue;
      chosen.add(p);
      if (size() > EXCERPT_LINES) chosen.delete(p);
    }
  }
  // A helper the excerpt calls and the full code defines (\`rowsBy(granularity)\`)
  // is named above the element, with its signature, so the excerpt reads on its own.
  const shownText = [...chosen].flatMap((p) => built.parts[p]!.lines).join('\n');
  const helpers = built.parts
    .filter((part, p) => !chosen.has(p) && part.kind !== 'wrapper')
    .flatMap((part) => [...part.lines.join('\n').matchAll(/^(?:export )?(?:const (\w+) = (?:async )?\(([^)]*)\)|function (\w+)\(([^)]*)\))/gm)])
    .map((m) => ({ name: (m[1] ?? m[3])!, params: (m[2] ?? m[4])! }))
    .filter(({ name }) => new RegExp(`\\b${name}\\(`).test(shownText));

  const lines: string[] = [];
  const excerptMarks: number[] = [];
  let previous: string | undefined;
  for (const p of [...chosen].sort((a, b) => a - b)) {
    const part = built.parts[p]!;
    // Declarations sit together, as in the module; other parts are spaced.
    if (lines.length && !(part.kind === 'declaration' && previous === 'declaration')) lines.push('');
    if (part.kind === 'element') for (const { name, params } of helpers) lines.push(helperComment(name, params));
    // The element, inside the wrapper lines that differ from the usage
    // example's (from the first that differs), and their closing tags.
    const open = built.parts.findIndex((q) => q.key === 'jsx-open');
    const close = built.parts.find((q) => q.key === 'jsx-close');
    const from = part.kind === 'element' && open >= 0 && marks[open]!.size ? Math.min(...marks[open]!) : -1;
    const around = from >= 0 ? built.parts[open]!.lines.slice(from) : [];
    const own = [...around, ...part.lines, ...(close?.lines.slice(0, around.length) ?? [])];
    const ownMarks = new Set([...[...marks[open] ?? []].filter((i) => i >= from && from >= 0).map((i) => i - from), ...[...marks[p]!].map((i) => i + around.length)]);
    const shown = part.kind === 'body' || part.kind === 'element' ? dedent(own) : part.lines;
    shown.forEach((line, i) => {
      if ((part.kind === 'element' ? ownMarks : marks[p]!).has(i)) excerptMarks.push(lines.length);
      lines.push(line);
    });
    previous = part.kind;
  }
  return { code: built.code, marked, excerpt: { code: lines.join('\n'), marked: excerptMarks } };
};

// The registry's descriptions and notes were written for gallery cards with a
// code drawer beside them. A page reads them as: one line of purpose, then the
// facts about the data a caller must get right.
const sentences = (text: string) => text.split(/(?<=[.!?])\s+(?=[A-Z`])/);

/** The component's purpose in one line. */
export const purposeOf = (entry: ChartEntry) => sentences(entry.description)[0]!;

/** What to know about this component's data and props, a sentence or two each. */
export const notesOf = (entry: ChartEntry): string[] =>
  [...sentences(entry.description).slice(1), ...(entry.notes ?? []), axisOrderNote(entry)]
    // A pointer to the gallery or to "the chart page" leads nowhere from here,
    // and the page has its own line on field options.
    .filter((note) => note && !/\bgallery\b|Field options on the chart page/i.test(note));

// The grouped and stacked bars sort their category axis (`uniqueAxis.sort()`
// in getBarStackedChartProData upstream); BarChart keeps the rows' order.
// tests/accuracy.test.tsx renders each with its rows out of order.
const SORTED_AXIS = ['BarChartStacked', 'BarChartStackedHorizontal', 'BarChartGrouped', 'BarChartGroupedHorizontal'];

/** The category axis's order, for a component that sorts it; empty for the rest. */
export const axisOrderNote = (entry: ChartEntry): string => {
  if (!SORTED_AXIS.includes(exportOf(entry))) return '';
  const axis = (componentProps[exportOf(entry)] ?? []).some((p) => p.name === 'yAxis') ? 'yAxis' : 'xAxis';
  return `The \`${axis}\` values are drawn A to Z, whatever the order of your rows, unless you pass \`axisOrder\`.`;
};

/**
 * The settings on-page code is printed for. The site's own look is a theme
 * preset; code for it prints with no theme object, as a reader starting out
 * would write it. Picking another preset shows what that theme adds.
 */
export const codeSettings = (settings: Pick<ChartSettings, 'themeId' | 'languageId' | 'datasetId'>) => ({
  themeId: settings.themeId === DEFAULT_THEME_ID ? ('default' as const) : settings.themeId,
  languageId: settings.languageId,
  datasetId: settings.datasetId,
});

/** The props the type declares and the component does not read, in a sentence; empty when there are none. */
export const ignoredNote = (entry: ChartEntry): string => {
  const ignored = ignoredProps(exportOf(entry)).filter((name) => (componentProps[exportOf(entry)] ?? []).some((p) => p.name === name));
  if (!ignored.length) return '';
  return `Not listed: ${list(ignored.map(code))}, which the type accepts and the component does not read.`;
};

export const propDescription = (prop: PropDoc, entry?: ChartEntry) =>
  propNote(prop.name, entry && exportOf(entry)) ?? prop.doc ?? '';

// `x: string | undefined` in a payload reads as `x?: string`, and a prop that
// accepts `undefined` while its query loads is still shown by its real type.
const tidyType = (type: string) =>
  type.replace(/(\w+)\??: ([^;{}]+?) \| undefined;/g, '$1?: $2;').replace(/ \| undefined\b/g, '');

/** A prop's type as the reference shows it. */
export const propType = (prop: PropDoc) => tidyType(prop.type);

/**
 * The shape behind a prop's named type (an event's payload, a table's state),
 * when it has one, exactly as the exported type declares it: a key that is
 * always there and may be \`undefined\` is not shown as optional. Each shape is
 * compiled against its export in tests/shapes.test.ts and by site:check.
 */
export const propShape = (prop: PropDoc) => prop.payload ?? '';

// Defaults the wrapper in src applies that neither componentDefaults nor the
// shared code defaults list: TableScrollable reads an unset `heightMode` as
// 'fixed' (src/TableScrollable.tsx). tests/accuracy.test.tsx renders both.
export const pageDefaults: Record<string, unknown> = { heightMode: 'fixed' };

/** The value a prop has when you leave it out, as code; empty when it is unset. */
export const propDefault = (entry: ChartEntry, prop: PropDoc): string => {
  const defaults = defaultsOf(entry);
  const known =
    prop.name in defaults ? defaults : prop.name in codeDefaults ? codeDefaults : prop.name in pageDefaults ? pageDefaults : undefined;
  if (!known) return '';
  // A "key|fallback" default (a control's placeholder) shows as the text it falls back to.
  const raw = known[prop.name];
  const value = typeof raw === 'string' && raw.includes('|') ? raw.split('|', 2)[1] : raw;
  return Array.isArray(value) ? `[${value.map((v) => JSON.stringify(v)).join(', ')}]` : JSON.stringify(value);
};

/** Under the props table: what a blank default means. */
export const DEFAULTS_LEGEND = 'A blank default means the prop is unset unless you pass it.';

export type KeyboardRow = { key: string; where: string; what: string };

// From /docs/accessibility#keyboard, narrowed to each component and checked
// against its source (src/generated-ui/components/charts/tables) in
// tests/accuracy.test.tsx.
const SORT: KeyboardRow = {
  key: '`Enter` or `Space`',
  where: 'Column header',
  what: 'Sorts ascending, then descending, then clears the sort.',
};
const COPY: KeyboardRow = {
  key: '`Enter` or `Space`',
  where: 'Copy button in a cell',
  what: 'Copies the cell’s value. The button shows on hover and while focus is in its cell.',
};
const keyboard: Record<string, KeyboardRow[]> = {
  TablePaginated: [
    {
      key: '`Tab`, `Shift` + `Tab`',
      where: 'Table',
      what: 'Moves between the column headers, each cell’s copy button and the page buttons.',
    },
    SORT,
    { key: '`Enter` or `Space`', where: 'Page button', what: 'Goes to the first, previous, next or last page.' },
    COPY,
  ],
  TableScrollable: [
    {
      key: '`Tab`, `Shift` + `Tab`',
      where: 'Table',
      what: 'Moves between the column headers and each cell’s copy button, scrolling the table to keep the focus in view.',
    },
    SORT,
    COPY,
  ],
  PivotTable: [
    {
      key: '`Tab`, `Shift` + `Tab`',
      where: 'Table',
      what: 'With `subRowDimension`, moves between the row headers. Without it, nothing in the table takes focus.',
    },
    { key: '`Enter` or `Space`', where: 'Row header, with `subRowDimension`', what: 'Opens or closes its sub-rows.' },
  ],
  HeatMap: [
    { key: '`Tab`, `Shift` + `Tab`', where: 'Grid', what: 'Moves from cell to cell: every cell takes focus.' },
    {
      key: '`Enter` or `Space`',
      where: 'Cell',
      what: 'Calls `onCellClicked` with the cell’s row and column values, if you passed it.',
    },
  ],
};

/** The keys a component's own controls answer to; undefined for one with none beyond the card menu. */
export const keyboardRows = (entry: ChartEntry): KeyboardRow[] | undefined => keyboard[exportOf(entry)];

const keyboardMarkdown = (entry: ChartEntry) => {
  const rows = keyboardRows(entry);
  if (!rows) return [];
  return [
    '## Keyboard',
    ['| Key | Where | What it does |', '|---|---|---|', ...rows.map((r) => `| ${cell(r.key)} | ${cell(r.where)} | ${cell(r.what)} |`)].join('\n'),
    'The card menu’s keys, and what is still missing, are in [Accessibility](/docs/accessibility.md#keyboard).',
  ];
};

// ---------------------------------------------------------------------------
// What the code does, said once and reused: the pages, the Markdown twins and
// the prompt take these sentences from here. tests/accuracy.test.tsx checks
// each against the library.
// ---------------------------------------------------------------------------

/** What a chart throws when it renders outside the provider (`useTheme` in src/runtime/react.ts). */
export const PROVIDER_ERROR = 'EmKit components must be rendered inside <ChartsProvider>.';

/** The provider, and what is on screen without it. */
export const PROVIDER_NOTE = `Wrap your app, or the part with charts, in \`<ChartsProvider>\` once: without it every chart throws \`${PROVIDER_ERROR}\``;

// Next.js App Router, as verified against the library: the package ships no
// 'use client' directive, and its components use context and state, so the
// provider's file and every chart's file need it. Every component then renders
// on the server (as its card, with an empty <canvas> that Chart.js fills in
// the browser). A server and a browser with different locales format numbers
// differently and React throws the server HTML away, so the provider pins one.
// A heat map colour you pass must be hex there (see HEAT_MAP_NEXT_NOTE).
export const NEXT_NOTE =
  'In the Next.js App Router, every file that renders `ChartsProvider` or a chart starts with `\'use client\'`, and the provider pins the locale, `theme={{ formatter: { locale: \'en-US\' } }}`, so the server and the browser format numbers alike.';

/**
 * The heat map's own server-rendering rule. Its cell colours are blended from
 * hex values (HeatMap.utils.ts upstream), which the server can do with no DOM:
 * the default colours are hex and match the browser's, while a named, `rgb()`
 * or `var()` colour you pass renders black on the server, and React keeps the
 * server's attributes. tests/accuracy.test.tsx renders both, on a server.
 */
export const HEAT_MAP_NEXT_NOTE =
  'On a server-rendered page, pass the heat map’s colours (`minColor`, `midColor`, `maxColor` or a theme chart colour) as hex, such as `\'#f4f0ff\'`: a named, `rgb()` or `var()` colour renders black on the server, and React keeps it. The default colours are hex and match.';

/** After the Next.js sentence: where the client files and the symptoms are. */
export const NEXT_LINK = { text: 'The quick start', rest: ' has the Next.js files.', path: '/docs/quick-start#in-the-nextjs-app-router' };

/** The one line under a component page's usage code, after the install command: the rest of the setup is on the quick start. */
export const USAGE_SETUP_LINE = 'Needs `<ChartsProvider>` once and a parent with a height:';
/** The same line for a control, which sizes itself. */
export const CONTROL_SETUP_LINE = 'Needs `<ChartsProvider>` once, and your own state for its value:';
export const USAGE_SETUP_PATH = '/docs/quick-start';

/** The Markdown twin's provider rule for its examples, which each bring their own provider. */
export const EXAMPLE_PROVIDER_NOTE =
  'Every example on this page includes `<ChartsProvider>` so that it runs on its own: if your app already has one, delete it from the example.';

/** The Next.js sentence for a component, with the heat map's extra rule on its own page. */
export const nextNote = (entry: ChartEntry) => (exportOf(entry) === 'HeatMap' ? `${NEXT_NOTE} ${HEAT_MAP_NEXT_NOTE}` : NEXT_NOTE);

/** The peer dependencies, in the words every page uses (package.json: \`>=19.1.1\` for both). */
export const PEER_NOTE = '`react` and `react-dom` 19.1.1 or later are the only peer dependencies; Chart.js installs with the package.';

/** What a reader would call the thing a component draws: a KPI is a card, not a chart. */
export const nounOf = (entry: ChartEntry): 'chart' | 'card' | 'table' | 'control' => {
  if (entry.group === 'Controls') return 'control';
  if (entry.group === 'KPIs') return 'card';
  return /^(Table|Pivot)/.test(exportOf(entry)) ? 'table' : 'chart';
};

/** How the component takes its size, in a sentence. */
export const sizingNote = (entry: ChartEntry): string => {
  const noun = nounOf(entry);
  const name = exportOf(entry);
  if (name === 'TablePaginated') {
    return 'The table fills its parent, so the parent needs a height: a page holds as many rows as fit it, reported as `state.pageSize`.';
  }
  if (name === 'TableScrollable') {
    return 'The table fills its parent and scrolls inside it, so the parent needs a height, unless `heightMode="auto"` lets the card grow to fit its rows.';
  }
  if (noun === 'card') return 'The card fills its parent, so the parent needs a height; the number scales to fit.';
  if (noun === 'control') return 'A control is as wide as its parent and as tall as its title and field, so it needs no height.';
  return `${noun === 'table' ? 'The table' : 'A chart'} fills its parent, so the parent needs a height.`;
};

/**
 * The states the component draws from \`results\` (see /docs/loading-empty-and-errors):
 * the card shows its skeleton only while it is loading and has no rows
 * (\`isLoading && !hasData\` in ChartCard upstream); with rows, it keeps them
 * and shows a spinner in its header. tests/accuracy.test.tsx renders each state.
 */
/** Whether the component takes rows, and so has a loading, an empty and an error state. A date picker or a text field does not. */
export const takesResults = (entry: ChartEntry) => propsOf(entry).some((p) => p.name === 'results');

export const statesNote = (entry: ChartEntry) =>
  nounOf(entry) === 'control'
    ? 'The select draws its own states from `results`: a spinner while `isLoading` is true, and “No options found” when `data` is `[]` or `error` is set. Pass your query’s state straight through.'
    : `The ${nounOf(entry)} draws its own states from \`results\`: a skeleton while \`isLoading\` is true and it has no rows, a spinner in the header while it reloads rows it already has, an empty state when \`data\` is \`[]\`, and the message when \`error\` is set. Pass your query’s state straight through.`;

// A time dimension with a granularity is read from the row key
// `name.<granularity>` rather than `name` when it is one of these props
// (`getDimensionFieldName` upstream). On the x-axis it is always `name`.
const granularityKeyed: Record<string, string[]> = {
  BarChartGrouped: ['groupBy'],
  BarChartGroupedHorizontal: ['groupBy'],
  BarChartStacked: ['groupBy'],
  BarChartStackedHorizontal: ['groupBy'],
  ScatterChart: ['pointDimension', 'groupByDimension'],
  BubbleChart: ['pointDimension', 'groupByDimension'],
};

/** The dimension props whose time values this component reads from `name.<granularity>`. */
export const granularityKeyProps = (entry: ChartEntry): string[] => granularityKeyed[exportOf(entry)] ?? [];

/** The row-key rule for those props, as a condition; empty for a component that has none. */
export const granularityKeyNote = (entry: ChartEntry): string => {
  const props = granularityKeyProps(entry);
  if (!props.length) return '';
  return `If a time field with a \`granularity\` is passed as ${list(props.map(code), 'or')}, its values are read from the row key \`name.<granularity>\` (for example \`created_at.month\`), not \`name\`.`;
};

// ---------------------------------------------------------------------------
// Siblings: where one family's components name their main props differently
// ---------------------------------------------------------------------------

const familyOf = (name: string) => {
  if (name.startsWith('Bar')) return 'bar';
  if (/^(Line|Area)/.test(name)) return 'line';
  if (/^(Pie|Donut)/.test(name)) return 'pie';
  if (/^(Scatter|Bubble)/.test(name)) return 'scatter';
  if (/^(HeatMap|Pivot)/.test(name)) return 'grid';
  return name;
};

// The fields a component cannot draw without: its required dimension and measure props.
const mainProps = (entry: ChartEntry): string[] => {
  const fields = componentFieldOptions[exportOf(entry)] ?? {};
  return requiredProps(entry).filter((name) => name in fields);
};

/** One line naming the main props of each sibling, when they differ from this component's. */
export const siblingNote = (entry: ChartEntry): string => {
  const signature = (e: ChartEntry) => mainProps(e).join(' + ');
  const siblings = chartEntries.filter((e) => e !== entry && familyOf(exportOf(e)) === familyOf(exportOf(entry)));
  const others = new Map<string, string[]>();
  for (const sibling of siblings) {
    if (signature(sibling) === signature(entry)) continue;
    others.set(signature(sibling), [...(others.get(signature(sibling)) ?? []), exportOf(sibling)]);
  }
  if (!others.size) return '';
  const props = (e: ChartEntry) => mainProps(e).map(code).join(' + ');
  const differ = [...others.values()].map((names) => {
    const first = chartEntries.find((e) => exportOf(e) === names[0])!;
    return `${list(names.map(code))} ${names.length > 1 ? 'take' : 'takes'} ${props(first)}`;
  });
  return `${code(exportOf(entry))} takes ${props(entry)}. Its siblings name their fields differently: ${differ.join('; ')}.`;
};

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const codeCell = (text: string) => (text ? `\`${cell(text)}\`` : '');

export const propsMarkdown = (entry: ChartEntry) => {
  const props = propsOf(entry);
  if (!props.length) return '';
  return [
    '| Prop | Type | Required | Default | Description |',
    '|---|---|---|---|---|',
    ...props.map(
      (p) =>
        `| \`${p.name}\` | ${codeCell(propType(p))} | ${p.required ? 'yes' : 'no'} | ${codeCell(propDefault(entry, p))} | ${cell(propDescription(p, entry))} |`,
    ),
  ].join('\n');
};

export { TIME_RANGE_NOTE } from './clickPayloads';

/** On the HTML page, in place of that note: where the Events guide says it, once. */
export const TIME_RANGE_LINK = { text: 'What a click’s `TimeRange` holds:', link: 'Events', path: '/docs/events#payload' };

/** True when the props or their shapes name `TimeRange`. */
export const usesTimeRange = (entry: ChartEntry) =>
  [...propsOf(entry).map((p) => `${propType(p)} ${propShape(p)}`)].some((text) => /\bTimeRange\b/.test(text));

/**
 * Every named type the props table leans on, spelled out as the package
 * declares it: event payloads and controlled state, then the types they and
 * the props mention (`Granularity`, `TimeRange`).
 */
export const typeShapes = (entry: ChartEntry): string[] => {
  const props = propsOf(entry);
  const shapes = [...new Set(props.map(propShape).filter(Boolean))];
  const mentioned = [...props.map(propType), ...shapes].join(' ');
  const defined = Object.entries(typeDefinitions)
    .filter(([name]) => new RegExp(`\\b${name}\\b`).test(mentioned))
    .map(([name, definition]) => `${name} = ${definition}`);
  return [...shapes, ...defined];
};

/** What a component's click handler is passed beyond its exported type; empty when nothing. */
export const clickPayloadNote = (entry: ChartEntry): string => {
  const handler = MEASURE_VALUES_HANDLERS[exportOf(entry)];
  if (!handler) return '';
  const unset = MEASURE_VALUE_UNSET.includes(exportOf(entry))
    ? ' It does not set `measureValue`, which the type declares: read the value from `measureValues`.'
    : '';
  return `\`${handler}\` is also passed \`measureValues\`, which its type leaves out: each measure’s value at the clicked point, keyed by the measure’s \`name\`.${unset}`;
};

const shapesMarkdown = (entry: ChartEntry) => {
  const shapes = typeShapes(entry);
  return [
    ...(shapes.length
      ? [
          ['```ts', ...shapes.map((s) => `type ${s}`), '```'].join('\n'),
          `Each is exported from \`${pkg}\` as a type, for example \`import type { ${shapes[0]!.split(' = ')[0]} } from '${pkg}'\`.`,
        ]
      : []),
    ...(usesTimeRange(entry) ? [TIME_RANGE_NOTE] : []),
    clickPayloadNote(entry),
  ]
    .filter(Boolean)
    .join('\n\n');
};

/** The field's granularity: the one that formats and fills, wherever it is written. */
export const GRANULARITY_FIELD_NOTE =
  'Its `granularity` is what labels the axis as dates and fills periods with no row; `dimension()` takes it in `inputs` or at the top level, `dimension({ granularity: \'month\' })`.';

export const fieldOptionsMarkdown = (entry: ChartEntry) => {
  const name = exportOf(entry);
  const guide = FIELD_OPTIONS_PATH.replace('#', '.md#');
  const time = timeFieldOptions(name);
  const intro = [
    `Options go in a field’s \`inputs\`, for example \`measure({ name: 'revenue', inputs: { prefix: '$' } })\`.`,
    `Every field takes ${list(COMMON_FIELD_OPTIONS.map(code))}.`,
    ...(time.fields.length
      ? [
          `A time dimension in ${list(time.fields.map(code), 'or')} also takes ${list(time.options.map(code))}.`,
          ...(time.options.includes('granularity') ? [GRANULARITY_FIELD_NOTE] : []),
        ]
      : []),
    `[Field options](${guide}) describes them.`,
  ].join(' ');
  const rows = specificFieldOptions(name);
  if (!rows.length) return intro;
  return [
    `${intro} \`${name}\` also reads:`,
    [
      '| Option | Type | Set on | Default | Description |',
      '|---|---|---|---|---|',
      ...rows.map(
        ({ option, fields }) =>
          `| \`${option.name}\` | ${codeCell(fieldOptionType(option))} | ${fields.map(code).join(', ')} | ${codeCell(fieldOptionDefault(option))} | ${cell(fieldOptionNote(option))} |`,
      ),
    ].join('\n'),
  ].join('\n\n');
};

const fence = (source: string, lang = 'tsx') => `\`\`\`${lang}\n${source}\n\`\`\``;

/** An example's text: what it shows, how it is done, and any default its code leaves out. The page and the twin both print it. */
export const exampleText = (entry: ChartEntry, example: ComponentExample) =>
  [example.description, ...(example.notes ?? []), defaultsNote(entry, example)].filter(Boolean).join(' ');

export const componentMarkdown = (entry: ChartEntry, examples: { example: ComponentExample; code: string }[]) => {
  const name = exportOf(entry);
  const [usage, ...rest] = examples;
  const sibling = siblingNote(entry);
  const notes = notesOf(entry);
  return [
    `# ${entry.name}`,
    purposeOf(entry),
    [
      `- Component: \`<${name} />\`, imported from \`${pkg}\``,
      `- Required props: ${list(requiredProps(entry).map(code))}`,
      `- HTML page, with live previews: ${BRAND.url}${componentPath(entry.id)}`,
      `- Playground (needs a browser): ${BRAND.url}${playgroundPath(entry.id)}`,
    ].join('\n'),
    ...(sibling ? [sibling] : []),
    '## Install',
    installMarkdown(),
    `${PEER_NOTE} ${PROVIDER_NOTE} ${EXAMPLE_PROVIDER_NOTE} ${sizingNote(entry)} ${nextNote(entry)} [${NEXT_LINK.text}](${markdownLink(NEXT_LINK.path)})${NEXT_LINK.rest}`,
    '## Usage',
    ...(usage ? [fence(usage.code)] : []),
    ...(notes.length ? [notes.map((n) => `- ${n}`).join('\n')] : []),
    ...(takesResults(entry) ? ['## States', statesNote(entry)] : []),
    ...(rest.length || writtenExamplesOf(entry).length
      ? [
          '## Examples',
          ...rest.flatMap(({ example, code: source }) => [
            `### ${example.name}`,
            exampleText(entry, example),
            fence(source),
          ]),
          ...writtenExamplesOf(entry).flatMap((written) => [
            `### ${written.name}`,
            [written.description, ...written.notes].join(' '),
            `\`\`\`tsx title="${written.file}"\n${written.code}\n\`\`\``,
          ]),
        ]
      : []),
    '## Props',
    ['Required props come first.', DEFAULTS_LEGEND, ignoredNote(entry)].filter(Boolean).join(' '),
    propsMarkdown(entry),
    shapesMarkdown(entry),
    '## Field options',
    fieldOptionsMarkdown(entry),
    ...keyboardMarkdown(entry),
  ]
    .filter(Boolean)
    .join('\n\n');
};

// The Markdown twins served at <page>.md and listed in llms.txt. They never
// depend on what the visitor has selected: default theme, English, SaaS data.
const markdownBase = { themeId: 'default', languageId: 'en', datasetId: 'saas' } as const;

/** A component's page as self-contained Markdown (served at /docs/components/<slug>.md). */
export const componentPageMarkdown = (entry: ChartEntry) =>
  componentMarkdown(
    entry,
    componentExamples(entry).map((example) => ({ example, code: exampleCode(entry, example, markdownBase) })),
  );

/** The components index as Markdown (served at /docs/components.md). */
export const componentsIndexMarkdown = () =>
  [
    '# Components',
    `${chartEntries.length} components in ${chartGroups.length} groups. Each links to its own page: purpose, install, usage, examples and props. Live previews: ${BRAND.url}/docs/components`,
    ...chartGroups.flatMap((group) => {
      const entries = chartEntries.filter((e) => e.group === group);
      return [
        `## ${group} (${entries.length})`,
        entries.map((e) => `- [${e.name}](${componentPath(e.id)}.md) (\`<${exportOf(e)} />\`): ${purposeOf(e)}`).join('\n'),
      ];
    }),
  ].join('\n\n');

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

// The time rules a chart holds rows to (/docs/time-series#time-values): a row
// is matched to its period by its exact start, so a mid-period or month-end
// value is dropped. A table or card only formats the value.
const timeValuesStep = (noun: 'chart' | 'card' | 'table') =>
  noun === 'chart'
    ? 'Time values are ISO strings with no time zone, each the start of its period: `2026-01-01T00:00:00.000` for January at `month`, the Monday for `week`. Rows at any other time are dropped. The time field’s `granularity` must match how my rows are bucketed: it labels the axis and fills periods with no row.'
    : 'Time values are ISO strings with no time zone, such as `2026-01-01T00:00:00.000`. The time field’s `granularity` sets how the dates are written.';

// A KPI card reads one number from one row (`results.data[0][measure.name]`
// upstream), and the comparison card only draws the change once it has
// `comparisonDateRange`, which `setComparisonDateRange` can work out for you.
const kpiSteps = (entry: ChartEntry): string[] => {
  const name = exportOf(entry);
  if (name === 'KpiNumber') {
    return ['   - The card reads only the first row: `results.data[0][measure.name]`. Pass one row holding the total, not one row per period.'];
  }
  if (name === 'KpiNumberComparison') {
    return [
      '   - The card reads only the first row of each result: `results.data[0][measure.name]` and `resultsComparison.data[0][measure.name]`. Pass one row holding each period’s total.',
      '   - The change only shows with `comparisonDateRange` set. To have the card work out that range, pass `primaryDateRange`, `comparisonPeriod` and `setComparisonDateRange`: it calls the setter with the comparison dates, so keep them in state, pass them back as `comparisonDateRange` and query `resultsComparison` for them.',
    ];
  }
  return [];
};

// A self-contained instruction for a coding agent: the code, the contract it
// must keep, and what not to rebuild. The steps are worded from the code they
// sit beside and from the component's own props, so neither can disagree with
// the prompt: if the code already has the provider or a sized wrapper, the
// prompt says so instead of asking for another, and it only names a legend,
// tooltips, paging or time values for a component that has them.
export const componentPrompt = (entry: ChartEntry, source: string, exampleName?: string) => {
  const name = exportOf(entry);
  const props = propsOf(entry);
  const noun = nounOf(entry);
  const hasProvider = source.includes('<ChartsProvider');
  const hasHeight = /height/i.test(source);
  const grows = source.includes('heightMode="auto"');
  const hasTime = /granularity|type: 'time'/.test(source);
  const what = exampleName && exampleName !== entry.name ? `${entry.name} (${exampleName.toLowerCase()})` : entry.name;
  const others = packageManagers
    .filter((m) => m !== 'npm')
    .map((m) => code(installCommand(m)))
    .join(', ');

  // A control holds a value and draws nothing from it: the steps are about
  // where the value goes, not about rows, heights or exports.
  if (noun === 'control') {
    const rows = has(props, 'results');
    const required = requiredProps(entry);
    return [
      `Add a ${what} to my React app with the \`<${name} />\` component from the \`${pkg}\` package.`,
      '',
      `1. Install the package if it is missing: \`${installCommand('npm')}\` (or ${others}). ${PEER_NOTE}`,
      '2. Start from this code:',
      '',
      fence(source),
      '',
      '3. Fit it into my app:',
      '   - Keep the value in my own state, as the code does with `useState`, or lift it to wherever my queries are built. The control does not filter anything itself: put the value into my query, and pass the rows that come back to my charts as `results`.',
      ...(rows
        ? ['   - Replace the sample rows with one row per option from my own data layer, as `results`: `{ isLoading, error, data: rows }`. Each row holds the `dimension` value.']
        : []),
      hasProvider
        ? '   - The code includes `<ChartsProvider>`. It is needed once, around the app or the part with charts and controls: if my app already has one, remove it from this code; if not, move it up to the app root.'
        : `   - Controls need \`<ChartsProvider>\` (from \`${pkg}\`) around the app, once. Add it if my app has none.`,
      '   - The control is as wide as its parent and needs no height: the wrapper in the code only sets the width of the example.',
      `   - In the Next.js App Router, every file that renders the provider or this control starts with \`'use client'\`.`,
      required.length
        ? `4. Required props: ${list(required.map(code))}. Every other prop is optional.`
        : '4. No prop is required.',
      `5. Do not rebuild what the control already does: ${list([
        ...(rows ? ['search', 'the loading and no-options states'] : []),
        ...(hasTime || /Date|Period/.test(name) ? ['date arithmetic for presets, in the provider’s time zone'] : []),
        'keyboard handling',
        'translations',
      ])}.`,
      '',
      `Full reference (every prop, more examples): ${BRAND.url}${componentPath(entry.id)}.md`,
    ].join('\n');
  }

  // A table that pages is controlled: these are optional in its types, and it
  // cannot page, sort or download without them.
  const paging = ['state', 'setState', 'totalResults', 'allResults'].filter((prop) => has(props, prop));
  const paged = has(props, 'state');
  const keyNote = granularityKeyNote(entry);

  const builtIn = [
    noun === 'card' ? 'number formatting' : 'number and date formatting',
    ...(noun === 'chart' ? ['colours'] : []),
    ...(has(props, 'showTooltips') ? ['tooltips'] : []),
    ...(has(props, 'showLegend') ? ['the legend'] : []),
    ...(has(props, 'resultsComparison') && noun === 'card' ? ['the change against the comparison and its colour'] : []),
    ...(paged ? ['the sort and paging controls'] : []),
    'loading, empty and error states',
    'export',
    'translations',
  ];

  return [
    `Add a ${what} to my React app with the \`<${name} />\` component from the \`${pkg}\` package.`,
    '',
    `1. Install the package if it is missing: \`${installCommand('npm')}\` (or ${others}). ${PEER_NOTE}`,
    '2. Start from this code:',
    '',
    fence(source),
    '',
    '3. Fit it into my app:',
    '   - Replace the sample rows with rows from my own data layer. Rows are plain objects, and each key must match a field’s `name`.',
    hasProvider
      ? '   - The code includes `<ChartsProvider>`. It is needed once, around the app or the part with charts: if my app already has one, remove it from this code; if not, move it up to the app root.'
      : `   - Charts need \`<ChartsProvider>\` (from \`${pkg}\`) around the app, or the part with charts, once. Add it if my app has none.`,
    grows
      ? `   - With \`heightMode="auto"\` the ${noun} grows to fit its rows, so it needs no height from its parent.`
      : hasHeight
        ? `   - The ${noun} fills its parent. Keep the wrapper’s height, or put the ${noun} in an element that already has one.`
        : `   - The ${noun} fills its parent, so render it inside an element with a height, for example \`<div style={{ height: 360 }}>\`.`,
    `   - Pass my query’s state as \`results\`: \`{ isLoading, error, data: rows }\`. The ${noun} draws its own loading, empty and error states.`,
    ...kpiSteps(entry),
    ...(paged
      ? [
          `   - The table is controlled. Keep \`state\` in \`useState\` and build my query from it: ${
            has(props, 'totalResults')
              ? '`state.page`, `state.pageSize` (the table sets it to the rows that fit) and `state.sort`. Pass the row count across all pages as `totalResults`.'
              : `\`state.page\` and \`state.sort\`. Serve ${TABLE_SCROLLABLE_SIZE} rows a page; a shorter page ends the scroll.`
          }`,
          '   - Pass every row, unpaged, as `allResults`: the CSV and Excel downloads in the card menu wait for it, and never finish without it. `state.isLoadingDownloadData` turns `true` when a reader asks for one, if I would rather fetch only then.',
        ]
      : []),
    ...(hasTime ? [`   - ${timeValuesStep(noun)}`] : []),
    ...(keyNote ? [`   - ${keyNote}`] : []),
    `   - In the Next.js App Router, every file that renders the provider or this ${noun} starts with \`'use client'\`, and the provider pins the locale, \`theme={{ formatter: { locale: 'en-US' } }}\` (or the reader’s locale from the request), so the server and the browser format numbers alike.${
      name === 'HeatMap' ? ` ${HEAT_MAP_NEXT_NOTE}` : ''
    }`,
    paging.length
      ? `4. The types require ${list(requiredProps(entry).map(code))}. To page, sort and download, the table also needs ${list(paging.map(code))}, as in the code. Every other prop is optional.`
      : `4. Required props: ${list(requiredProps(entry).map(code))}. Every other prop is optional.`,
    `5. Do not rebuild what the component already does: ${list(builtIn)}. Formatting is set on each field’s \`inputs\` (\`prefix\`, \`suffix\`, \`decimalPlaces\`, \`currency\`).`,
    '',
    `Full reference (every prop, field options, more examples): ${BRAND.url}${componentPath(entry.id)}.md`,
  ].join('\n');
};
