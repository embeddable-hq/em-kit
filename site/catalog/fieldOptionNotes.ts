import { componentFieldOptions, FieldOptionDoc } from '../generated/props';

// Field options are the keys of a field's `inputs`:
//   measure({ name: 'revenue', inputs: { prefix: '$' } })
// The list per component is generated (site/generated/props.ts) with the
// labels of the Embeddable builder, which read as form labels ("Prefix.") or
// refer to builder controls. These are the same options in plain words.

/** Where the options every field takes are documented, once. */
export const FIELD_OPTIONS_PATH = '/docs/describing-your-data#field-options';

/** Formatting options: every field of every component takes them. */
export const COMMON_FIELD_OPTIONS = [
  'prefix',
  'suffix',
  'decimalPlaces',
  'currency',
  'abbreviateLargeNumber',
  'displayName',
  'maxCharacters',
];

/** Options every time dimension takes. */
export const TIME_FIELD_OPTIONS = ['granularity', 'showGranularityDropdown', 'dateBounds', 'ignoreEmptyDate'];

const shared = new Set([...COMMON_FIELD_OPTIONS, ...TIME_FIELD_OPTIONS]);

const notes: Record<string, string> = {
  // On every field
  prefix: 'Text put before each value, such as `$`.',
  suffix: 'Text put after each value, such as `%`.',
  decimalPlaces: 'How many decimal places to show.',
  currency: 'An ISO currency code such as `EUR`. Formats the value as money in the reader’s locale.',
  abbreviateLargeNumber: 'Shorten large numbers: 1,200,000 becomes 1.2M.',
  displayName: 'A label shown in place of the field’s `title`.',
  maxCharacters: 'Cut text values off after this many characters.',

  // On time dimensions
  granularity: 'The time bucket of the rows: `day`, `week`, `month`, `quarter` or `year`.',
  showGranularityDropdown:
    'Show a granularity picker in the card. Pass `setGranularity` to the chart to receive the choice.',
  dateBounds:
    'The first and last date of the axis, as `{ from, to }`. Periods inside the range with no rows are drawn as gaps. The default is the range of your rows.',
  ignoreEmptyDate: 'Leave out periods with no rows instead of drawing them as gaps.',

  // Bars
  color: 'A colour for this measure’s bars, in place of the theme’s.',
  showValueAsPercentage: 'Label each value with its share of the total. The tooltip shows both.',

  // Lines
  lineColor: 'A colour for this measure’s line, in place of the theme’s.',
  dashedLine: 'Draw the line dashed.',
  connectGaps: 'Draw a missing value as zero, so the line carries on. When off, the line breaks at the gap.',
  fillUnderLine: 'Shade the area under the line.',
  useSecondaryAxis: 'Plot this measure against the right-hand axis, with its own scale.',
  previousLineColor: 'A colour for the comparison period’s line.',
  lineDashed: 'Draw the current period’s line dashed.',
  previousLineDashed: 'Draw the comparison period’s line dashed. When off, it is solid like the current line.',

  // KPI tabs
  invertChangeColors: 'Colour an increase as bad and a decrease as good, for costs or churn.',
  reverseTrendDirection: 'Point the trend arrow the other way. When unset, the arrow follows `invertChangeColors`.',
  displayChangeAsPercentage: 'Show the change as a percentage instead of a difference.',
  percentageDecimalPlaces: 'Decimal places on the percentage change. Only read with `displayChangeAsPercentage`.',

  // Tables
  width: 'The column’s width in pixels.',
  align: 'Align the column’s cells left, centre or right.',
  tableCellStyle: 'Style the column’s cells. `Positive vs Negative` colours values above zero as good and the rest as bad.',
  displayFormat: 'Render the cell’s text as Markdown, or as indented JSON.',
  columnAggregation: 'Add a row under the table for each calculation you list, worked out down each column.',
  rowAggregation: 'Add a column at the end of the table for each calculation you list, worked out along each row.',
  showAsPercentage: 'Show each cell as a share of the total instead of its value. Other measures may be left out.',
};

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** What an option does, in plain words, with what it applies to and its default. */
export const fieldOptionNote = (option: FieldOptionDoc): string => {
  const parts = [notes[option.name] ?? sentence([option.label, option.description].filter(Boolean).join('. '))];
  if (option.supportedTypes) parts.push(`Only on ${option.supportedTypes.join(' and ')} fields.`);
  return parts.join(' ');
};

export const hasFieldOptionNote = (name: string) => name in notes;

/** The option's type as you would write it: 'left' | 'center' | 'right', boolean, string[]. */
export const fieldOptionType = (option: FieldOptionDoc): string => {
  const named: Record<string, string> = { color: 'string', timeRange: '{ from: Date; to: Date }', granularity: 'Granularity' };
  const base = option.options?.length
    ? option.options.map((o) => `'${o}'`).join(' | ')
    : (named[option.type] ?? option.type);
  if (!option.array) return base;
  return option.options && option.options.length > 1 ? `(${base})[]` : `${base}[]`;
};

// The generated `defaultValue` is what the Embeddable builder fills in for an
// option its author left unset. This package has no builder: a chart sees the
// option as unset. Where that reads differently from the builder's default,
// this is what the package does, and what the reference prints.
// tests/accuracy.test.tsx renders each chart with the option unset and with
// the default printed here, and expects the same chart.
const packageDefaults: Record<string, unknown> = {
  // Read as `Boolean(inputs.connectGaps)`: off unless set.
  connectGaps: false,
  // Read straight off `inputs`: solid unless set.
  previousLineDashed: false,
  // No default at all: without a granularity a time axis is neither formatted nor filled.
  granularity: undefined,
};

/** The value a chart behaves as if an unset option had, as code; empty when it has none. */
export const fieldOptionDefault = (option: FieldOptionDoc): string => {
  const value = option.name in packageDefaults ? packageDefaults[option.name] : option.defaultValue;
  return value === undefined ? '' : JSON.stringify(value);
};

export type FieldOptionRow = { option: FieldOptionDoc; fields: string[] };

// Options the builder offers for a component whose code never reads them.
// The reference leaves them out; tests/accuracy.test.tsx proves each changes nothing.
const ignored: Record<string, string[]> = {
  // An area chart always fills under its lines.
  AreaChart: ['fillUnderLine'],
};

/** The field options this component is offered and ignores, which the reference does not list. */
export const ignoredFieldOptions = (exportName: string): string[] => ignored[exportName] ?? [];

const rowsOf = (exportName: string, keep: (name: string) => boolean): FieldOptionRow[] => {
  const byName = new Map<string, FieldOptionRow>();
  for (const [fieldName, field] of Object.entries(componentFieldOptions[exportName] ?? {})) {
    for (const option of field.inputs) {
      if (!keep(option.name) || ignoredFieldOptions(exportName).includes(option.name)) continue;
      const row = byName.get(option.name);
      if (row) row.fields.push(fieldName);
      else byName.set(option.name, { option, fields: [fieldName] });
    }
  }
  return [...byName.values()];
};

/** Options this component reads beyond the ones every field takes. One row per option. */
export const specificFieldOptions = (exportName: string): FieldOptionRow[] => rowsOf(exportName, (name) => !shared.has(name));

/** The time options this component reads, and the field props that take them (they can hold a time dimension). */
export const timeFieldOptions = (exportName: string): { options: string[]; fields: string[] } => {
  const rows = rowsOf(exportName, (name) => TIME_FIELD_OPTIONS.includes(name));
  return {
    options: TIME_FIELD_OPTIONS.filter((name) => rows.some((row) => row.option.name === name)),
    fields: [...new Set(rows.flatMap((row) => row.fields))],
  };
};

/** The component's field props that take options at all. */
export const fieldProps = (exportName: string): string[] =>
  Object.entries(componentFieldOptions[exportName] ?? {})
    .filter(([, field]) => field.inputs.length > 0)
    .map(([name]) => name);
