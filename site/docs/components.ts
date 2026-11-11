import { buildChart, ChartRuntime, ChartSettings } from '../catalog/build';
import { ChartEntry, DataState } from '../catalog/registry';
import { BRAND } from '../config';
import { propNote } from '../catalog/propNotes';
import { componentFieldOptions, componentProps, PropDoc } from '../generated/props';

// Everything a component's docs page says, derived from the registry and the
// generated props so it can't drift from the code: its examples, what it does
// for you, its Markdown (Copy page) and its agent prompt (Copy prompt).

const pkg = BRAND.packageName;

export type ComponentExample = {
  id: string;
  name: string;
  description: string;
  variantId?: string;
  dataState: DataState;
  /** Prop values layered over the entry's own, as the playground does. */
  overrides?: Record<string, unknown>;
};

const stateExamples: ComponentExample[] = [
  {
    id: 'loading',
    name: 'Loading',
    description: 'While `results.isLoading` is true and there are no rows yet: a skeleton in the card.',
    dataState: 'loading',
  },
  {
    id: 'empty',
    name: 'Empty',
    description: 'When the query returns no rows: a designed empty state instead of a blank axis.',
    dataState: 'empty',
  },
  {
    id: 'error',
    name: 'Error',
    description: 'When `results.error` is set: the message in the card, nothing to catch.',
    dataState: 'error',
  },
];

export const propsOf = (entry: ChartEntry): PropDoc[] => componentProps[String(entry.exportName)] ?? [];

const has = (props: PropDoc[], name: string) => props.some((p) => p.name === name);

// Examples every chart gets from its props, showing behaviour a chart library
// leaves to you. Category charts only: time axes don't bucket into "Other".
const capabilityExamples = (entry: ChartEntry): ComponentExample[] => {
  const props = propsOf(entry);
  if (entry.usesGranularity) return [];
  if (!has(props, 'xAxisMaxItems')) return [];
  return [
    {
      id: 'other-bucket',
      name: 'Long tail grouped into “Other”',
      description:
        '`xAxisMaxItems: 3` shows at most three bars: the largest values, with the rest added up into one “Other” bar. A long tail stays readable without pre-aggregating your rows.',
      dataState: 'ready',
      overrides: { xAxisMaxItems: 3 },
    },
  ];
};

export const componentExamples = (entry: ChartEntry): ComponentExample[] => [
  { id: 'default', name: entry.name, description: entry.description, dataState: 'ready' },
  ...(entry.variants ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    variantId: v.id,
    dataState: 'ready' as const,
  })),
  ...capabilityExamples(entry),
  ...stateExamples,
];

// What the component does that a chart library leaves to you, from its props.
export const builtIns = (entry: ChartEntry): string[] => {
  const props = propsOf(entry);
  const events = props.filter((p) => /^on[A-Z]/.test(p.name)).map((p) => `\`${p.name}\``);
  const fieldOptions = Object.values(componentFieldOptions[String(entry.exportName)] ?? {}).flatMap((f) =>
    f.inputs.map((i) => i.name),
  );
  const isTable = has(props, 'dimensionsAndMeasures') || has(props, 'rowDimension') || has(props, 'columnDimension');
  const items: string[] = [];

  if (fieldOptions.includes('prefix') || fieldOptions.includes('decimalPlaces')) {
    items.push('Values formatted in the reader’s locale from each field’s options: prefix, suffix, decimals, currency, compact numbers');
  }
  if (!isTable && (has(props, 'dimension') || has(props, 'groupBy') || has(props, 'measures') || has(props, 'sectionDimension'))) {
    items.push('One colour per value, shared with every other chart on the page and kept across refreshes');
  }
  if (has(props, 'granularity')) {
    items.push('Missing periods filled at every granularity, time-zone aware, with a granularity picker in the card');
  }
  if (has(props, 'resultsComparison') || has(props, 'comparisonPeriod')) {
    items.push('Comparison period worked out from the primary range and overlaid on the same axis');
  }
  if (has(props, 'resultsGroupOther') || has(props, 'xAxisMaxItems')) {
    items.push('Long tails grouped into “Other” so the chart stays readable');
  }
  if (has(props, 'showLegend') || has(props, 'showTooltips')) {
    items.push('Legend, tooltips and value labels formatted like the axes');
  }
  if (has(props, 'state') && has(props, 'setState')) {
    items.push('Paging and sorting handed to your API, so only one page is ever in memory');
  }
  if (events.length) items.push(`Typed click events (${events.join(', ')}) carrying the clicked value and time range`);
  items.push('A finished card: title, description, info tooltip, and loading, empty and error states');
  if (has(props, 'menuOptions')) items.push('CSV, Excel and PNG export and a maximize view, from the card menu');
  items.push('Titles, field names and values translated; English, German and French built in');
  return items;
};

const noop = () => {};
const staticRuntime: ChartRuntime = {
  granularity: 'month',
  setGranularity: noop,
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: noop,
  onEvent: noop,
};

export const exampleCode = (
  entry: ChartEntry,
  example: ComponentExample,
  base: Pick<ChartSettings, 'themeId' | 'languageId' | 'datasetId'>,
) =>
  buildChart(
    entry,
    { ...base, toggles: {}, dataState: example.dataState, variantId: example.variantId, overrides: example.overrides },
    staticRuntime,
  ).code;

const propType = (prop: PropDoc) => prop.type.replace(/\|/g, '\\|');

export const propDescription = (prop: PropDoc) => propNote(prop.name) ?? prop.doc ?? '';

export const propsMarkdown = (entry: ChartEntry) => {
  const props = propsOf(entry);
  if (!props.length) return '';
  return [
    '| Prop | Type | Required | Description |',
    '|---|---|---|---|',
    ...props.map(
      (p) => `| \`${p.name}\` | \`${propType(p)}\` | ${p.required ? 'yes' : ''} | ${propDescription(p).replace(/\|/g, '\\|')} |`,
    ),
  ].join('\n');
};

// A self-contained instruction for a coding agent: the code, the contract it
// must keep, and what not to rebuild. No URL: the site isn't public yet.
export const componentPrompt = (entry: ChartEntry, code: string, exampleName?: string) =>
  [
    `Add a ${exampleName && exampleName !== entry.name ? `${entry.name} (${exampleName})` : entry.name} to my React app using the \`${pkg}\` package (\`<${String(entry.exportName)} />\`).`,
    '',
    `1. Install it: \`npm install ${pkg}\`. React 19 is the only peer dependency; Chart.js comes with it.`,
    '2. Wrap the app, or the part with charts, in `<ChartsProvider>` once. Skip this if it is already there.',
    '3. Start from this code:',
    '',
    '```tsx',
    code,
    '```',
    '',
    '4. Replace the sample rows with rows from my own data layer. Keep these rules:',
    '   - Rows are plain objects; each key must match a field’s `name`.',
    '   - Pass the query state as `results`: `{ isLoading, error, data: rows }`. The chart shows its own loading, empty and error states.',
    '   - Time values are ISO strings without a zone (`2026-01-31T00:00:00.000`). For a time field with a granularity, supply each value under both `name` and `name.<granularity>`.',
    '   - Put the chart in an element with a height; it fills its container.',
    '5. Don’t rebuild what the component already does: number and date formatting, colours, tooltips, legends, loading/empty/error states, export and translations. Set formatting on each field’s `inputs` (`prefix`, `suffix`, `decimalPlaces`, `currency`).',
  ].join('\n');

export const componentMarkdown = (entry: ChartEntry, examples: { example: ComponentExample; code: string }[]) =>
  [
    `# ${entry.name}`,
    entry.description,
    `\`<${String(entry.exportName)} />\` from \`${pkg}\`.`,
    '## Installation',
    `\`\`\`bash\nnpm install ${pkg}\n\`\`\``,
    '## What it does for you',
    builtIns(entry)
      .map((b) => `- ${b}`)
      .join('\n'),
    '## Examples',
    ...examples.flatMap(({ example, code }) => [`### ${example.name}`, example.description, `\`\`\`tsx\n${code}\n\`\`\``]),
    '## Props',
    propsMarkdown(entry),
    ...(entry.notes?.length ? ['## Notes', entry.notes.map((n) => `- ${n}`).join('\n')] : []),
  ]
    .filter(Boolean)
    .join('\n\n');
