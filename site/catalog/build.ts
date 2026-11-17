// From its own module: the package's index would bring in every component.
import { TABLE_SCROLLABLE_SIZE } from '../../src/generated/components/charts/tables/TableScrollable/TableScrollable.utils';
import type { DataResponse, FieldInputs, Granularity } from '../../src';
import { componentDefaults } from '../../src/componentDefaults.generated';
import { BRAND } from '../config';
import { Dataset, datasetList, datasets, DatasetId, Row } from './datasets';
import { commentLines, formatExpression, formatHugged, formatOpen, formatStatement, MAX_WIDTH, WIDTH } from './format';
import {
  applyDataState,
  BuildContext,
  ChartEntry,
  CodeRef,
  DataState,
  FieldSlot,
  getVariant,
  isCodeRef,
  TableState,
  titleId,
  withInputs,
} from './registry';
import { exampleHeight, exampleWidth } from './sizes';
import { DEFAULT_THEME_ID, getThemePreset, LanguageId, languages, ThemeId } from './themes';
import { chartTitle, chartTitleKey, siteTranslations, snippetTranslations } from './translations';

export type ChartSettings = {
  // A preset from the entry's `variants`, layered over its props.
  variantId?: string;
  datasetId: DatasetId;
  dataState: DataState;
  toggles: Record<string, boolean>;
  // Prop values set in the playground; overlaid onto the registry props, so
  // the preview and the generated code pick them up together.
  overrides?: Record<string, unknown>;
  // Field options set in the playground, by field prop (e.g. measures): merged
  // into the inputs of every field that prop holds.
  fieldOverrides?: Record<string, FieldInputs>;
  themeId: ThemeId;
  languageId: LanguageId;
  // Leave event handlers out of the printed code. The docs pages do: a handler
  // that logs to the console is noise in a usage example. The playground keeps
  // them, beside its event log.
  omitHandlers?: boolean;
};

export type ChartRuntime = {
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;
  tableState: TableState;
  setTableState: React.Dispatch<React.SetStateAction<TableState>>;
  onEvent: (name: string, payload: unknown) => void;
};

/**
 * A run of lines in the printed module, named so that two examples' code can
 * be compared part by part (see `exampleExcerpt` in content/components.ts).
 */
export type CodePart = {
  kind: 'imports' | 'declaration' | 'rows' | 'helper' | 'theme' | 'body' | 'element' | 'wrapper';
  key: string;
  lines: string[];
};

export type BuiltChart = {
  props: Record<string, unknown>;
  code: string;
  /** `code`, line for line, as the parts it is made of. */
  parts: CodePart[];
  /** Each printed set of rows, as the preview receives it. */
  sampleRows: { varName: string; rows: Row[] }[];
};

// The generated code is a complete module: imports, fields, sample rows and a
// component, so it runs as pasted. It is printed from the values the preview
// receives, not from the registry's code strings, so the two cannot disagree.
// Where rows are printed, the preview is handed those same rows.

const resultsCode = (varName: string, state: DataState) => {
  if (state === 'loading') return '{ isLoading: true }';
  if (state === 'empty') return 'results([])';
  if (state === 'error') return "{ isLoading: false, error: 'The query timed out after 30 seconds.' }";
  return `results(${varName})`;
};

type Field = {
  name: string;
  title: string;
  nativeType: string;
  __type__: string;
  description?: string;
  meta?: object;
  inputs?: Record<string, unknown>;
};

const isField = (value: unknown): value is Field =>
  typeof value === 'object' && value !== null && '__type__' in value && 'name' in value;

const isResponse = (value: unknown): value is DataResponse =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && typeof (value as DataResponse).isLoading === 'boolean';

const unwrap = (value: unknown): unknown => {
  if (isCodeRef(value)) return value.value;
  if (Array.isArray(value)) return value.map(unwrap);
  return value;
};

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

// A scrollable table appends every new array of rows it is handed, so the
// preview hands it the same array for the same rows, build after build.
const stable = new Map<string, Row[]>();
const stableRows = (rows: Row[]): Row[] => {
  const key = JSON.stringify(rows);
  const known = stable.get(key);
  if (known) return known;
  if (stable.size > 500) stable.delete(stable.keys().next().value!);
  stable.set(key, rows);
  return rows;
};

export { exampleHeight, exampleWidth } from './sizes';

// The rows behind a response handed to the chart, by the name the registry gave them.
type RowSource = { name: string; rows: Row[] };

// The values this module supplies for a chart's own state. The printed code
// has to supply them too, so they are recognised by identity.
type Wiring = { setGranularity: CodeRef; table: BuildContext['table']; downloads: Map<unknown, Row[]> };

// The time field as the charts take it. The card's granularity picker is left
// off: the printed code wires it only where an example is about it (the line
// chart's "Granularity picker"), and a preview shows what its code shows.
const timeField = (ds: Dataset, granularity: Granularity) => {
  const field = ds.time(granularity);
  const { showGranularityDropdown: _picker, ...inputs } = field.inputs ?? {};
  return { ...field, inputs } as typeof field;
};

export const buildChart = (entry: ChartEntry, settings: ChartSettings, runtime: ChartRuntime): BuiltChart => {
  const ds = datasets[settings.datasetId];
  const sources = new Map<unknown, RowSource>();

  const field = (slot: FieldSlot): CodeRef => ({
    __code: ds.specs[slot].varName,
    value: slot === 'time' ? timeField(ds, runtime.granularity) : ds[slot],
    slot,
  });

  const rows = (varName: string, data: Row[]): CodeRef => {
    const value = applyDataState({ isLoading: false, data }, settings.dataState);
    sources.set(value, { name: varName, rows: data });
    return { __code: resultsCode(varName, settings.dataState), value };
  };

  // Every row behind a table that pages, for `allResults`. Its rows are the
  // set the printed table is cut from.
  const downloads = new Map<unknown, Row[]>();
  const allRows = (data: Row[]): CodeRef => {
    const ref: CodeRef = {
      __code: resultsCode('sorted', settings.dataState),
      value: applyDataState({ isLoading: false, data }, settings.dataState),
    };
    downloads.set(ref, data);
    return ref;
  };

  const wiring: Wiring = {
    setGranularity: { __code: 'setGranularity', value: runtime.setGranularity },
    downloads,
    table: {
      all: allRows,
      state: { __code: 'state', value: runtime.tableState },
      setState: { __code: 'setState', value: runtime.setTableState },
      rows: {
        __code: resultsCode('pageRows', settings.dataState),
        value: applyDataState({ isLoading: false, data: ds.byCategory }, settings.dataState),
      },
      total: {
        __code: '{ isLoading: false, total }',
        value: { isLoading: false, total: ds.byCategory.length } satisfies DataResponse,
      },
    },
  };
  sources.set(wiring.table.rows.value, { name: 'rows', rows: ds.byCategory });

  const variant = getVariant(entry, settings.variantId);
  const ctx: BuildContext = {
    ds,
    field,
    rows,
    handler: (name) => ({
      __code: `(event) => console.log('${name}', event)`,
      value: (payload: unknown) => runtime.onEvent(name, payload),
    }),
    granularity: runtime.granularity,
    setGranularity: wiring.setGranularity,
    table: wiring.table,
    toggles: settings.toggles,
    // A preset with no title of its own keeps its component's.
    title:
      variant && chartTitle(ds, titleId(entry, variant)) === undefined
        ? chartTitleKey(ds, entry.id, entry.defaultTitle)
        : chartTitleKey(ds, titleId(entry, variant), variant?.title ?? entry.defaultTitle),
  };

  const rawProps = { ...entry.props(ctx), ...variant?.props(ctx) };
  for (const [key, value] of Object.entries(settings.overrides ?? {})) {
    if (value !== undefined) rawProps[key] = value;
  }
  for (const [key, inputs] of Object.entries(settings.fieldOverrides ?? {})) {
    const set = Object.fromEntries(Object.entries(inputs).filter(([, v]) => v !== undefined)) as FieldInputs;
    if (!Object.keys(set).length || rawProps[key] === undefined) continue;
    const apply = (v: unknown) => (isCodeRef(v) && isField(v.value) ? withInputs(v, set) : v);
    const current = rawProps[key];
    rawProps[key] = Array.isArray(current) ? current.map(apply) : apply(current);
  }

  const printed = printCode({ entry, ds, settings, rawProps, sources, wiring, runtime });
  const props = Object.fromEntries(
    Object.entries(rawProps).map(([key, value]) => [key, printed.preview.has(key) ? printed.preview.get(key) : unwrap(value)]),
  );
  return { props, code: printed.parts.flatMap((part) => part.lines).join('\n'), parts: printed.parts, sampleRows: printed.sampleRows };
};

// ---- Literals ---------------------------------------------------------------

const isIdentifier = (text: string) => /^[A-Za-z_$][\w$]*$/.test(text);

const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;

const printKey = (key: string) => (isIdentifier(key) ? key : quote(key));

const literal = (value: unknown): string => {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return quote(value);
  if (value instanceof Date) {
    // A date at midnight UTC reads as its day, as `new Date('2026-01-05')` parses it.
    const iso = value.toISOString();
    return `new Date(${quote(iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso)})`;
  }
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    return entries.length ? `{ ${entries.map(([k, v]) => `${printKey(k)}: ${literal(v)}`).join(', ')} }` : '{}';
  }
  return String(value);
};

// As many entries per line as fit: for long, flat lists such as theme tokens.
const fill = (entries: string[], indent: number): string[] => {
  const lines: string[] = [];
  for (const entry of entries) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + entry.length <= WIDTH) lines[lines.length - 1] = `${last} ${entry}`;
    else lines.push(`${' '.repeat(indent)}${entry}`);
  }
  return lines;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const camel = (name: string) => {
  const last = name.split('.').pop() ?? name;
  const text = last.replace(/[^A-Za-z0-9]+(.)?/g, (_, next: string | undefined) => (next ? next.toUpperCase() : ''));
  return isIdentifier(text) ? text : 'field';
};

// ---- Translations -----------------------------------------------------------

type Strings = { [key: string]: string | Strings };

// i18next reads "a.b.c" as a path, and also finds a key that itself holds dots.
const lookup = (strings: Strings | string | undefined, key: string): string | undefined => {
  if (typeof strings !== 'object') return undefined;
  const parts = key.split('.');
  for (let i = parts.length; i > 0; i--) {
    const found = strings[parts.slice(0, i).join('.')];
    if (i === parts.length && typeof found === 'string') return found;
    const deeper = i < parts.length ? lookup(found, parts.slice(i).join('.')) : undefined;
    if (deeper !== undefined) return deeper;
  }
  return undefined;
};

let siteStrings: Record<string, { translation: Strings }> | undefined;

// The site's own translation of a "key|fallback" string, placed where the key points.
const withTranslation = (content: Strings, language: string, key: string) => {
  if (lookup(content, key) !== undefined) return;
  siteStrings ??= siteTranslations(datasetList);
  const translated = lookup(siteStrings[language]?.translation, key);
  if (translated === undefined) return;
  const path = key.split('.');
  let at = content;
  for (const part of path.slice(0, -1)) {
    const next = at[part];
    at = at[part] = typeof next === 'object' ? next : {};
  }
  at[path[path.length - 1]!] = translated;
};

// ---- Fields -----------------------------------------------------------------

// `dimension({...})` or `measure({...})` for a field as the chart receives it.
const fieldCall = (field: Field, omit: string[] = []): string => {
  const isDimension = field.__type__ === 'dimension';
  const { granularity, ...rest } = field.inputs ?? {};
  const inputs = Object.fromEntries(
    Object.entries(isDimension ? rest : { ...rest, granularity }).filter(([k, v]) => v !== undefined && !omit.includes(k)),
  );
  const parts = [`name: ${quote(field.name)}`];
  if (field.title !== field.name) parts.push(`title: ${quote(field.title)}`);
  if (field.nativeType !== (isDimension ? 'string' : 'number')) parts.push(`type: ${quote(field.nativeType)}`);
  if (field.description) parts.push(`description: ${quote(field.description)}`);
  if (field.meta) parts.push(`meta: ${literal(field.meta)}`);
  if (isDimension && granularity && !omit.includes('granularity')) parts.push(`granularity: ${literal(granularity)}`);
  if (Object.keys(inputs).length) parts.push(`inputs: ${literal(inputs)}`);
  return `${isDimension ? 'dimension' : 'measure'}({ ${parts.join(', ')} })`;
};

// Props the library reads as three-state: leaving one out is not the same as
// `false`, so `false` has to be printed. (A KPI's arrow follows its colour
// unless reverseTrendDirection says which way to point.)
const FALSE_IS_NOT_ABSENT = new Set(['reverseTrendDirection']);

// Props a component's type requires that do nothing until another prop is
// set: the code has to pass them, so it says why, once, above the first.
// (None today: the pivot table's sub-row props became optional.)
const REQUIRED_BY_TYPE: Record<string, { props: string[]; until: string; comment: string }> = {};

// ---- Sample rows --------------------------------------------------------------

/** Up to this many rows are printed, and drawn, whole. */
export const MAX_PRINTED_ROWS = 15;

// The x-axis reads a time value under the field's name. A chart that groups or
// plots points by a time dimension reads `name.<granularity>` instead.
const readsGranularityKey = (prop: string) => /group|point/i.test(prop);

/** Each row with only the keys the chart's fields read. */
const trimRows = (rows: Row[], uses: { prop: string; field: Field }[]): Row[] => {
  const keys = new Set<string>();
  for (const { prop, field } of uses) {
    keys.add(field.name);
    const granularity = field.nativeType === 'time' ? field.inputs?.granularity : undefined;
    if (!granularity) continue;
    const key = `${field.name}.${String(granularity)}`;
    if (readsGranularityKey(prop) || rows.some((row) => key in row && row[key] !== row[field.name])) keys.add(key);
  }
  return rows.map((row) => {
    const kept = Object.entries(row).filter(([key]) => keys.has(key));
    return kept.length ? (Object.fromEntries(kept) as Row) : row;
  });
};

/**
 * The rows to print, and to draw: all of them up to MAX_PRINTED_ROWS. Past
 * that, as many whole runs of the first key as fit, so a series or a stack is
 * never cut in half.
 */
export const cutRows = (rows: Row[]): Row[] => {
  if (rows.length <= MAX_PRINTED_ROWS) return rows;
  const lead = Object.keys(rows[0]!)[0]!;
  let count = 0;
  while (count < rows.length) {
    let end = count + 1;
    while (end < rows.length && rows[end]![lead] === rows[count]![lead]) end++;
    if (end > MAX_PRINTED_ROWS) break;
    count = end;
  }
  return rows.slice(0, count || MAX_PRINTED_ROWS);
};

const rowVarFor = (prop: string) => {
  const rest = /^results(.+)$/.exec(prop)?.[1] ?? /^(.+)Results$/.exec(prop)?.[1];
  return rest ? `${rest.charAt(0).toLowerCase()}${rest.slice(1)}Rows` : 'rows';
};

// A row to a line, as data reads best. A row too wide for one line breaks
// into a key per line, and then so does every row of its set.
const rowsDeclaration = (name: string, rows: Row[], annotation = ''): string[] => {
  const flat = rows.map(literal);
  const single = `const ${name}${annotation} = [${flat.join(', ')}];`;
  if (rows.length === 1 && single.length <= WIDTH) return [single];
  const wide = flat.some((row) => row.length + 3 > MAX_WIDTH);
  const body = flat.flatMap((row) => `  ${wide ? formatOpen(row, 2) : row},`.split('\n'));
  return [`const ${name}${annotation} = [`, ...body, '];'];
};

// ---- The granularity picker ----------------------------------------------------

// A picker example prints rows by day and a stand-in for the query that sums
// them into the period the reader picks; the preview draws that same sum.
const periodOf = (day: Date, granularity: Granularity) => {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  let start = Date.UTC(y, m, 1);
  if (granularity === 'quarter') start = Date.UTC(y, m - (m % 3), 1);
  if (granularity === 'week') start = Date.UTC(y, m, day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return new Date(start).toISOString().slice(0, 23);
};

const firstDay = (rows: Row[], time: string) => new Date(`${String(rows[0]![time])}Z`);

/** The daily rows summed into periods, as the printed `rowsBy` does. */
const bucketDays = (rows: Row[], time: string, measure: string, granularity: Granularity): Row[] => {
  const start = firstDay(rows, time);
  const sums = new Map<string, number>();
  rows.forEach((row, i) => {
    const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
    const key = periodOf(day, granularity);
    sums.set(key, (sums.get(key) ?? 0) + Number(row[measure] ?? 0));
  });
  return [...sums].map(([key, value]) => ({ [time]: key, [measure]: value }));
};

const pickerHelpers = (rows: Row[], time: string, measure: Field): CodePart[] => {
  const start = firstDay(rows, time);
  const [y, m, d] = [start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()];
  const values = rows.map((row) => String(row[measure.name] ?? 0));
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][start.getUTCDay()];
  const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m];
  const long = `${weekday} ${d} ${month} ${y}`;
  const days: string[] = [
    ...commentLines(`${measure.title} per day from ${long}, as your database holds them.`, 0),
    'const daily = [',
    ...fill(values.map((v) => `${v},`), 2),
    '];',
  ];
  const keyed = isIdentifier(measure.name) ? measure.name : `${quote(measure.name)}: value`;
  const rowsBy = [
    ...commentLines('Stand-in for your API: the days summed into the periods the reader picks, each keyed by its first day.', 0),
    'const rowsBy = (granularity: Granularity) => {',
    '  const sums = new Map<string, number>();',
    '  daily.forEach((value, i) => {',
    ...formatStatement(`    const key = periodOf(new Date(Date.UTC(${y}, ${m}, ${d} + i)), granularity);`),
    '    sums.set(key, (sums.get(key) ?? 0) + value);',
    '  });',
    `  return [...sums].map(([key, ${isIdentifier(measure.name) ? measure.name : 'value'}]) => ({`,
    `    ${quote(time)}: key,`,
    `    ${keyed},`,
    '  }));',
    '};',
  ];
  const period = [
    '// The first day of the week, month or quarter that a day falls in.',
    'const periodOf = (day: Date, granularity: Granularity) => {',
    '  const y = day.getUTCFullYear();',
    '  const m = day.getUTCMonth();',
    '  let start = Date.UTC(y, m, 1);',
    "  if (granularity === 'quarter') start = Date.UTC(y, m - (m % 3), 1);",
    "  if (granularity === 'week') {",
    '    start = Date.UTC(y, m, day.getUTCDate() - ((day.getUTCDay() + 6) % 7));',
    '  }',
    '  return new Date(start).toISOString().slice(0, 23); // drop the "Z"',
    '};',
  ];
  return [
    { kind: 'rows', key: 'rows:daily', lines: days },
    { kind: 'helper', key: 'helper:periodOf', lines: period },
    { kind: 'helper', key: 'helper:rowsBy', lines: rowsBy },
  ];
};

// ---- The module -------------------------------------------------------------

type PrintArgs = {
  entry: ChartEntry;
  ds: Dataset;
  settings: ChartSettings;
  rawProps: Record<string, unknown>;
  sources: Map<unknown, RowSource>;
  wiring: Wiring;
  runtime: ChartRuntime;
};

/** A JSX attribute before it is printed: a bare flag, a string, or an expression. */
type Attribute = { name: string; flag?: true; text?: string; code?: string; comment?: string };

const printAttribute = (attribute: Attribute, indent: number): string[] => {
  const pad = ' '.repeat(indent);
  const above = attribute.comment ? commentLines(attribute.comment, indent) : [];
  if (attribute.flag) return [...above, `${pad}${attribute.name}`];
  if (attribute.text !== undefined) {
    const text = attribute.text;
    return [...above, /["&\\\n]/.test(text) ? `${pad}${attribute.name}={${quote(text)}}` : `${pad}${attribute.name}="${text}"`];
  }
  const lead = indent + attribute.name.length + 2;
  return [...above, ...`${pad}${attribute.name}={${formatHugged(attribute.code!, indent, lead, 1)}}`.split('\n')];
};

const printCode = ({ entry, ds, settings, rawProps, sources, wiring, runtime }: PrintArgs) => {
  const { granularity, tableState } = runtime;
  const pkg = BRAND.packageName;
  const exportName = String(entry.exportName);
  const defaults = (componentDefaults as Record<string, Record<string, unknown>>)[exportName] ?? {};
  const language = languages.find((l) => l.id === settings.languageId) ?? languages[0]!;
  const english = language.id === 'en';
  const entries = Object.entries(rawProps);
  const values = Object.values(rawProps);
  const stateful = values.includes(wiring.table.state) || values.includes(wiring.table.setState);
  const preview = new Map<string, unknown>();

  // Fields, in the order the props use them. A field used once, or the same
  // way every time, is declared whole; one used with different options is
  // declared plain and spread where the options differ.
  const uses = entries.flatMap(([prop, raw]) =>
    (Array.isArray(raw) ? raw : [raw]).flatMap((item) => {
      const value = isCodeRef(item) ? item.value : item;
      if (!isField(value)) return [];
      const named = isCodeRef(item) ? (item.field?.base ?? item.__code) : '';
      return [{ prop, item, field: value, varName: isIdentifier(named) ? named : camel(value.name) }];
    }),
  );
  const declared = new Map<string, Field>();
  for (const use of uses) {
    if (declared.has(use.varName)) continue;
    const group = uses.filter((u) => u.varName === use.varName);
    const plain = group.find((u) => !(isCodeRef(u.item) && u.item.field));
    const slot = isCodeRef(use.item) ? use.item.slot : undefined;
    const base = slot ? ((slot === 'time' ? timeField(ds, granularity) : ds[slot]) as Field) : use.field;
    const uniform = group.every((u) => fieldCall(u.field) === fieldCall(use.field));
    declared.set(use.varName, uniform ? use.field : (plain?.field ?? base));
  }
  const fieldCode = (item: unknown, field: Field, varName: string) =>
    fieldCall(declared.get(varName)!) === fieldCall(field) ? varName : isCodeRef(item) ? item.__code : fieldCall(field);

  // The card's granularity picker, wired. It needs the reader's choice in
  // state, the field at that granularity and rows to match: an example about
  // it hands in daily rows and the range the picker works within.
  const xAxis = uses.find((u) => u.prop === 'xAxis' && u.field.nativeType === 'time');
  const dropdown = Boolean(xAxis?.field.inputs?.showGranularityDropdown);
  const measureUses = uses.filter((u) => u.field.__type__ === 'measure');
  const daily = rawProps.results !== undefined ? sources.get(unwrap(rawProps.results)) : undefined;
  const picker =
    dropdown && values.includes(wiring.setGranularity) && Boolean(xAxis?.field.inputs?.dateBounds) && measureUses.length === 1 && daily
      ? { field: xAxis!, measure: measureUses[0]!.field, rows: daily.rows }
      : undefined;

  // ---- Rows: one declaration per result set that has rows, and the preview
  // draws exactly those.
  const taken = new Set(declared.keys());
  const rowSets: { name: string; rows: Row[] }[] = [];
  const rowVars = new Map<unknown, string>();
  const tableProp = stateful ? (entries.find(([, raw]) => raw === wiring.table.rows)?.[0] ?? 'results') : undefined;
  const paged = values.includes(wiring.table.total);
  // A table prints a cut of every row it pages through, and pages that cut.
  const tableSource =
    [...wiring.downloads].find(([ref]) => values.includes(ref))?.[1] ??
    (tableProp ? sources.get(unwrap(rawProps[tableProp]))?.rows : undefined);
  const tableRows = tableSource ? cutRows(trimRows(tableSource, uses)) : [];
  const sortedTable = stableRows(sortRows(tableRows, tableState.sort));
  const pageSize = tableState.pageSize ?? 10;
  const ready = settings.dataState === 'ready';

  for (const [prop, raw] of entries) {
    const response = unwrap(raw);
    if (wiring.downloads.has(raw)) {
      if (ready) preview.set(prop, { isLoading: false, data: sortedTable });
      continue;
    }
    if (raw === wiring.table.total) {
      preview.set(prop, { isLoading: false, total: tableRows.length });
      continue;
    }
    if (!isResponse(response) || !response.data?.length || rowVars.has(response)) continue;
    if (picker && prop === 'results') {
      preview.set(prop, { isLoading: false, data: stableRows(bucketDays(picker.rows, picker.field.field.name, picker.measure.name, granularity)) });
      rowVars.set(response, 'daily');
      continue;
    }
    const source = sources.get(response);
    let name = prop === tableProp ? 'rows' : (source?.name ?? rowVarFor(prop));
    while (taken.has(name)) name = `${name}Data`;
    taken.add(name);
    rowVars.set(response, name);
    if (prop === tableProp) {
      rowSets.push({ name, rows: tableRows });
      const shown = paged ? sortedTable.slice(tableState.page * pageSize, (tableState.page + 1) * pageSize) : sortedTable;
      preview.set(prop, { ...response, data: paged ? shown : sortedTable });
      continue;
    }
    const printedRows = stableRows(cutRows(trimRows(source?.rows ?? (response.data as Row[]), uses)));
    rowSets.push({ name, rows: printedRows });
    preview.set(prop, { ...response, data: printedRows });
  }
  const tableVar = tableProp ? rowVars.get(unwrap(rawProps[tableProp])) : undefined;

  const responseCode = (prop: string, response: DataResponse): string => {
    const name = rowVars.get(response);
    if (!response.data || (!name && response.data.length)) return literal(response);
    if (picker && name === 'daily') return 'results(rowsBy(granularity))';
    const { data: _data, isLoading, ...extra } = response;
    const more = { ...(isLoading ? { isLoading } : {}), ...extra };
    const rows = !name ? '[]' : prop !== tableProp ? name : paged ? 'pageRows' : 'sorted';
    return `results(${rows}${Object.values(more).some((v) => v !== undefined) ? `, ${literal(more)}` : ''})`;
  };

  // Each prop as a JSX attribute; null when the pasted code does not need it.
  // A declaration that is sample data (a date range) is printed with the rows.
  const hoisted: string[] = [];
  const hoistedData: string[] = [];
  const expression = (prop: string, raw: unknown): string | null => {
    if (raw === wiring.table.state) return 'state';
    if (raw === wiring.table.setState) return 'setState';
    if (raw === wiring.setGranularity) return 'setGranularity';
    if (raw === wiring.table.total && tableVar) return `{ isLoading: false, total: ${tableVar}.length }`;
    // Every row, in the current sort: the module's `sorted`, or the state the table itself is in.
    if (wiring.downloads.has(raw)) return (raw as CodeRef).__code;
    if (Array.isArray(raw)) {
      const items = raw.map((item) => expression(prop, item)).filter((item) => item !== null);
      return `[${items.join(', ')}]`;
    }
    const value = isCodeRef(raw) ? raw.value : raw;
    if (isResponse(value)) return responseCode(prop, value);
    if (picker && raw === picker.field.item) return `{ ...${picker.field.varName}, inputs: { ...${picker.field.varName}.inputs, granularity } }`;
    if (isField(value)) return fieldCode(raw, value, uses.find((u) => u.item === raw)?.varName ?? camel(value.name));
    if (!isCodeRef(raw)) return literal(raw);
    if (!isIdentifier(raw.__code)) return raw.__code;
    if (raw.declare) {
      const into = raw.data ? hoistedData : hoisted;
      if (!into.includes(raw.declare)) into.push(raw.declare);
      return raw.__code;
    }
    // A name the module does not define: print what it stood for.
    return typeof value === 'function' ? null : literal(value);
  };

  // "key|fallback" strings are translation keys; in English the chart shows the fallback.
  const text = (value: string) => (english && value.includes('|') ? (value.split('|', 2)[1]?.trim() || value) : value);

  const attribute = (prop: string, raw: unknown): Attribute | null => {
    // Without the picker, setGranularity has nothing to call it.
    if (raw === wiring.setGranularity && !picker) return null;
    if (settings.omitHandlers && isCodeRef(raw) && raw.__code.startsWith('(event) => console.log(')) return null;
    const value = unwrap(raw);
    if (value === undefined) return null;
    if (prop in defaults ? same(value, defaults[prop]) : value === false && !FALSE_IS_NOT_ABSENT.has(prop)) return null;
    if (value === true) return { name: prop, flag: true };
    if (typeof value === 'string' && (!isCodeRef(raw) || (isIdentifier(raw.__code) && !raw.declare))) {
      // A string too long for its line (a translation key and its fallback) is declared above.
      const shown = text(value);
      if (10 + prop.length + shown.length + 3 > WIDTH && isIdentifier(prop) && !taken.has(prop)) {
        taken.add(prop);
        hoisted.push(`const ${prop} = ${quote(shown)};`);
        return { name: prop, code: prop };
      }
      return { name: prop, text: shown };
    }
    const code = expression(prop, raw);
    if (code === null) return null;
    // Left out, the card menu's downloads start and never finish: say what it is for, where it is set.
    const required = REQUIRED_BY_TYPE[exportName];
    const idle = required && required.props[0] === prop && rawProps[required.until] === undefined;
    const comment = wiring.downloads.has(raw)
      ? 'Every row, unpaged: the card menu’s downloads wait for it.'
      : idle
        ? required.comment
        : undefined;
    return { name: prop, code, comment };
  };
  const attributes = entries.map(([prop, raw]) => attribute(prop, raw)).filter((a): a is Attribute => a !== null);

  // ---- Declarations
  const parts: CodePart[] = [];
  const declarations: CodePart[] = [];
  for (const [varName, field] of declared) {
    if (picker && varName === picker.field.varName) {
      // No granularity here: the component sets it from state. The range
      // decides which granularities the picker offers.
      const { dateBounds, granularity: _state, showGranularityDropdown: _on, ...rest } = field.inputs ?? {};
      const lines = [
        `const ${varName} = dimension({`,
        `  name: ${quote(field.name)},`,
        ...(field.title !== field.name ? [`  title: ${quote(field.title)},`] : []),
        "  type: 'time',",
        '  inputs: {',
        '    showGranularityDropdown: true,',
        ...Object.entries(rest)
          .filter(([, v]) => v !== undefined)
          .flatMap(([k, v]) => `    ${printKey(k)}: ${formatExpression(literal(v), 4, 6 + k.length, 1)},`.split('\n')),
        ...commentLines('The picker offers the granularities with 1 to 100 periods in this range.', 4),
        ...`    dateBounds: ${formatOpen(literal(dateBounds), 4)},`.split('\n'),
        '  },',
        '});',
      ];
      declarations.push({ kind: 'declaration', key: `field:${varName}`, lines });
      continue;
    }
    declarations.push({ kind: 'declaration', key: `field:${varName}`, lines: formatStatement(`const ${varName} = ${fieldCall(field)};`) });
  }
  hoisted.forEach((line, i) => declarations.push({ kind: 'declaration', key: `hoisted:${i}:${line.split('=')[0]}`, lines: formatStatement(line) }));
  const dataDeclarations: CodePart[] = hoistedData.map((line) => ({
    kind: 'declaration',
    key: `data:${line.split('=')[0]}`,
    lines: formatStatement(line),
  }));

  const rowParts: CodePart[] = rowSets.map(({ name, rows }) => {
    const types = [...new Set(rows.flatMap((row) => Object.values(row).map((v) => (v === null ? 'null' : typeof v))))];
    return { kind: 'rows', key: `rows:${name}`, lines: rowsDeclaration(name, rows, name === tableVar ? `: Record<string, ${types.join(' | ')}>[]` : '') };
  });
  if (dropdown && !picker && rowParts.length) {
    // Only where the playground turns the picker on: it needs more than the field option.
    rowParts[0]!.lines.unshift(...commentLines('The picker in the card also needs setGranularity, and rows at the granularity it reports.', 0));
  }
  const helperParts = picker && ready ? pickerHelpers(picker.rows, picker.field.field.name, picker.measure) : [];

  // ---- Theme: nothing for the look the site opens with or the library's own.
  // A language adds its strings, declared on their own so they sit shallow.
  const preset = getThemePreset(settings.themeId);
  const styles = preset.id === 'default' || preset.id === DEFAULT_THEME_ID ? {} : preset.styles;
  const theme: string[] = [];
  const stringsPart: CodePart[] = [];
  if (Object.keys(styles).length) {
    theme.push('  styles: {', ...Object.entries(styles).map(([k, v]) => `    ${quote(k)}: ${quote(v)},`), '  },');
  }
  if (!english) {
    const fieldNames = [...declared.values()].map((field) => ({
      name: field.name,
      kind: field.__type__ === 'measure' ? ('measure' as const) : ('dimension' as const),
    }));
    const content: Strings | null = snippetTranslations(ds, titleId(entry, getVariant(entry, settings.variantId)), fieldNames, language.id);
    // Every other "key|fallback" string the chart is given (a label, an axis title) needs its translation too.
    for (const value of values.map(unwrap)) {
      if (content && typeof value === 'string' && value.includes('|')) withTranslation(content, language.id, value.split('|', 2)[0]!.trim());
    }
    if (content) {
      stringsPart.push({
        kind: 'theme',
        key: 'strings',
        lines: [
          '// Your own strings: titles use "key|fallback", fields resolve by name.',
          ...`const strings = ${formatOpen(literal(content), 0)};`.split('\n'),
        ],
      });
    }
    const i18n = `{ language: ${quote(language.id)}${content ? `, translations: { ${language.id}: { translation: strings } }` : ''} }`;
    theme.push(...`  i18n: ${formatExpression(i18n, 2, 8, 1)},`.split('\n'), `  formatter: { locale: ${quote(language.locale)} },`);
  }
  const themePart: CodePart | undefined = theme.length ? { kind: 'theme', key: 'theme', lines: ['const theme = {', ...theme, '};'] } : undefined;

  // ---- Component
  const body: string[] = [];
  // A table's stand-in for the reader's API sorts with a helper printed after
  // the rows, so the component reads first.
  const sortHelper: CodePart[] = [];
  if (stateful) {
    const stateType = `${exportName}State`;
    body.push(...formatStatement(`  const [state, setState] = useState<${stateType}>({ page: 0, isLoadingDownloadData: false });`));
    if (tableVar) {
      if (paged) {
        body.push(
          '  // Stand-in for your API: the page the table asks for, in its sort order.',
          '  const { page, pageSize = 10, sort } = state;',
          `  const sorted = sortRows(${tableVar}, sort);`,
          '  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);',
        );
      } else {
        body.push(
          '  // Stand-in for your API. Memoised: the table appends every new array.',
          `  const sorted = useMemo(() => sortRows(${tableVar}, state.sort), [state.sort]);`,
        );
      }
      const note = paged
        ? 'The rows in the order the table asks for: a column, ascending or descending.'
        : `The rows in the order the table asks for. With more rows, serve ${TABLE_SCROLLABLE_SIZE} a page by state.page; a shorter page ends the scroll.`;
      sortHelper.push({
        kind: 'helper',
        key: 'helper:sortRows',
        lines: [
          ...commentLines(note, 0),
          `const sortRows = (data: typeof ${tableVar}, sort: ${stateType}['sort']) => {`,
          '  if (!sort) return data;',
          "  const sign = sort.direction === 'desc' ? -1 : 1;",
          '  return [...data].sort((a, b) => (a[sort.id]! > b[sort.id]! ? sign : -sign));',
          '};',
        ],
      });
    }
  }
  if (picker) body.push(...formatStatement(`  const [granularity, setGranularity] = useState<Granularity>(${quote(granularity)});`));
  const hasBody = body.length > 0;
  // Sized for the rows the preview draws, which are the rows printed.
  const height = exampleHeight(entry, Object.fromEntries(entries.map(([prop, raw]) => [prop, preview.has(prop) ? preview.get(prop) : unwrap(raw)])));
  // A preset about a small card draws one, as wide as it says.
  const width = height ? exampleWidth(entry, settings.variantId) : undefined;
  const size = [...(width ? [`width: ${width}`] : []), `height: ${height}`].join(', ');
  const pad = hasBody ? '    ' : '  ';
  const inner = height ? `${pad}    ` : `${pad}  `;
  const open = [`<ChartsProvider${theme.length ? ' theme={theme}' : ''}>`, ...(height ? [`  <div style={{ ${size} }}>`] : [])].map(
    (line) => `${pad}${line}`,
  );
  const close = [...(height ? ['  </div>'] : []), '</ChartsProvider>'].map((line) => `${pad}${line}`);
  const element = [`${inner}<${exportName}`, ...attributes.flatMap((a) => printAttribute(a, inner.length + 2)), `${inner}/>`];

  // ---- Imports, from what the module ended up using
  const usesMemo = body.some((line) => line.includes('useMemo('));
  const reactHooks = [...(hasBody ? ['useState'] : []), ...(usesMemo ? ['useMemo'] : [])].sort();
  const allLines = [...declarations, ...rowParts, ...helperParts].flatMap((p) => p.lines).concat(body, element);
  const helpers = ['dimension', 'measure', 'results'].filter((name) => allLines.some((line) => new RegExp(`\\b${name}\\(`).test(line)));
  const types = [...(stateful ? [`${exportName}State`] : []), ...(picker ? ['Granularity'] : [])];
  const imports = [
    ...(reactHooks.length ? [`import { ${reactHooks.join(', ')} } from 'react';`] : []),
    ...formatStatement(`import { ${['ChartsProvider', exportName, ...helpers].join(', ')} } from '${pkg}';`),
    ...(types.length ? formatStatement(`import type { ${types.join(', ')} } from '${pkg}';`) : []),
  ];

  // ---- Assembly: the fields, then the component, then the sample data it
  // reads (rows, date ranges and any stand-in for a query), so the component
  // call is near the top. Blank lines between the groups, and around rows that
  // span several lines.
  const blank = (key: string): CodePart => ({ kind: 'wrapper', key, lines: [''] });
  parts.push({ kind: 'imports', key: 'imports', lines: imports }, blank('after-imports'));
  parts.push(...declarations);
  for (const part of stringsPart) parts.push(blank('before-strings'), part);
  if (themePart) parts.push(blank('before-theme'), themePart);
  if (declarations.length || themePart) parts.push(blank('before-component'));
  if (hasBody) {
    parts.push(
      { kind: 'wrapper', key: 'component-open', lines: ['export const Example = () => {'] },
      { kind: 'body', key: 'body', lines: body },
      { kind: 'wrapper', key: 'jsx-open', lines: ['  return (', ...open] },
    );
  } else {
    parts.push({ kind: 'wrapper', key: 'jsx-open', lines: ['export const Example = () => (', ...open] });
  }
  parts.push(
    { kind: 'element', key: 'element', lines: element },
    { kind: 'wrapper', key: 'jsx-close', lines: [...close, ...(hasBody ? ['  );', '};'] : [');'])] },
  );
  if (dataDeclarations.length) parts.push(blank('before-data'), ...dataDeclarations);
  const spaced = rowParts.some((p) => p.lines.length > 1) || helperParts.length > 0 || sortHelper.length > 0;
  rowParts.forEach((part, i) => {
    if (i === 0 || spaced) parts.push(blank(`before-${part.key}`));
    parts.push(part);
  });
  for (const part of [...helperParts, ...sortHelper]) parts.push(blank(`before-${part.key}`), part);

  const sampleRows = [
    ...rowSets.map(({ name, rows }) => ({ varName: name, rows })),
    ...(picker && ready ? [{ varName: 'daily', rows: picker.rows }] : []),
  ];
  return { parts, preview, sampleRows };
};
