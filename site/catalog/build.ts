import type { DataResponse, Granularity } from '../../src';
import { BRAND } from '../config';
import { Dataset, datasets, DatasetId, FieldSpec, Row } from './datasets';
import {
  applyDataState,
  BuildContext,
  ChartEntry,
  CodeRef,
  DataState,
  FieldSlot,
  isCodeRef,
  TableState,
} from './registry';
import { getThemePreset, LanguageId, languages, ThemeId } from './themes';
import { chartTitleKey, snippetTranslations } from './translations';

export type ChartSettings = {
  datasetId: DatasetId;
  dataState: DataState;
  toggles: Record<string, boolean>;
  title?: string;
  themeId: ThemeId;
  languageId: LanguageId;
};

export type ChartRuntime = {
  granularity: Granularity;
  setGranularity: (g: Granularity) => void;
  tableState: TableState;
  setTableState: React.Dispatch<React.SetStateAction<TableState>>;
  onEvent: (name: string, payload: unknown) => void;
};

export type BuiltChart = {
  props: Record<string, unknown>;
  code: string;
  sampleRows: { varName: string; rows: Row[] }[];
};

const resultsCode = (varName: string, state: DataState) => {
  if (state === 'loading') return '{ isLoading: true }';
  if (state === 'empty') return 'results([])';
  if (state === 'error') return "{ isLoading: false, error: 'The query timed out after 30 seconds.' }";
  return `results(${varName})`;
};

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

export const buildChart = (entry: ChartEntry, settings: ChartSettings, runtime: ChartRuntime): BuiltChart => {
  const ds = datasets[settings.datasetId];
  const usedFields = new Set<FieldSlot>();
  const rowVars = new Map<string, Row[]>();
  const hoisted: string[] = [];

  const field = (slot: FieldSlot): CodeRef => {
    usedFields.add(slot);
    return {
      __code: ds.specs[slot].varName,
      value: slot === 'time' ? ds.time(runtime.granularity) : ds[slot],
    };
  };

  const rows = (varName: string, data: Row[]): CodeRef => {
    if (settings.dataState === 'ready') rowVars.set(varName, data);
    return {
      __code: resultsCode(varName, settings.dataState),
      value: applyDataState({ isLoading: false, data }, settings.dataState),
    };
  };

  const pageSize = runtime.tableState.pageSize ?? 10;
  const pageRows = sortRows(ds.byCategory, runtime.tableState.sort).slice(
    runtime.tableState.page * pageSize,
    (runtime.tableState.page + 1) * pageSize,
  );

  const ctx: BuildContext = {
    ds,
    field,
    rows,
    handler: (name) => ({
      __code: `(event) => console.log('${name}', event)`,
      value: (payload: unknown) => runtime.onEvent(name, payload),
    }),
    granularity: runtime.granularity,
    setGranularity: { __code: 'setGranularity', value: runtime.setGranularity },
    table: {
      state: { __code: 'state', value: runtime.tableState },
      setState: { __code: 'setState', value: runtime.setTableState },
      rows: {
        __code: resultsCode('pageRows', settings.dataState),
        value: applyDataState({ isLoading: false, data: pageRows }, settings.dataState),
      },
      total: {
        __code: '{ isLoading: false, total }',
        value: { isLoading: false, total: ds.byCategory.length } satisfies DataResponse,
      },
    },
    toggles: settings.toggles,
    title: settings.title ?? chartTitleKey(ds, entry.id, entry.defaultTitle),
  };

  const rawProps = entry.props(ctx);
  for (const value of Object.values(rawProps)) {
    if (isCodeRef(value) && value.declare) hoisted.push(value.declare);
  }

  const props = Object.fromEntries(Object.entries(rawProps).map(([k, v]) => [k, unwrap(v)]));
  if (entry.usesTableState && settings.dataState === 'ready') rowVars.set('pageRows', pageRows);

  return {
    props,
    code: printCode({ entry, ds, settings, rawProps, usedFields, rowVars, hoisted }),
    sampleRows: [...rowVars.entries()].map(([varName, data]) => ({ varName, rows: data })),
  };
};

const printValue = (value: unknown): string => {
  if (isCodeRef(value)) return value.__code;
  if (Array.isArray(value)) return `[${value.map(printValue).join(', ')}]`;
  return JSON.stringify(value);
};

const printProp = (key: string, value: unknown): string | null => {
  if (value === undefined || value === false) return null;
  if (value === true) return key;
  if (typeof value === 'string') return `${key}="${value.replace(/"/g, '&quot;')}"`;
  return `${key}={${printValue(value)}}`;
};

const printObjectLiteral = (value: unknown): string => {
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) return `[${value.map(printObjectLiteral).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{ ${Object.entries(value)
      .map(([k, v]) => `${k}: ${printObjectLiteral(v)}`)
      .join(', ')} }`;
  }
  return String(value);
};

const printKey = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key.replace(/'/g, "\\'")}'`);

const printNested = (value: unknown, depth: number): string => {
  if (typeof value !== 'object' || value === null) return `'${String(value).replace(/'/g, "\\'")}'`;
  const pad = '  '.repeat(depth + 1);
  const entries = Object.entries(value).map(([k, v]) => `${pad}${printKey(k)}: ${printNested(v, depth + 1)},`);
  return `{\n${entries.join('\n')}\n${'  '.repeat(depth)}}`;
};

const printField = (spec: FieldSpec, kind: 'dimension' | 'measure', extra?: string) => {
  const parts: Record<string, unknown> = { name: spec.name, title: spec.title };
  if (spec.type && spec.type !== 'string') parts.type = spec.type;
  if (spec.inputs) parts.inputs = spec.inputs;
  let literal = printObjectLiteral(parts);
  if (extra) literal = literal.replace(/ }$/, `, ${extra} }`);
  return `const ${spec.varName} = ${kind}(${literal});`;
};

const sampleComment = (varName: string, data: Row[]) => {
  const first = data[0];
  if (!first) return `// ${varName}: []`;
  const fields = Object.entries(first)
    .map(([k, v]) => `${/^[a-zA-Z_]+$/.test(k) ? k : `'${k}'`}: ${typeof v === 'string' ? `'${v}'` : v}`)
    .join(', ');
  return `// ${varName}: [{ ${fields} }, …]`;
};

type PrintArgs = {
  entry: ChartEntry;
  ds: Dataset;
  settings: ChartSettings;
  rawProps: Record<string, unknown>;
  usedFields: Set<FieldSlot>;
  rowVars: Map<string, Row[]>;
  hoisted: string[];
};

const printCode = ({ entry, ds, settings, rawProps, usedFields, rowVars, hoisted }: PrintArgs): string => {
  const preset = getThemePreset(settings.themeId);
  const language = languages.find((l) => l.id === settings.languageId)!;
  const hasTheme = preset.id !== 'default' || language.id !== 'en';
  const usesGranularity = Boolean(entry.usesGranularity);
  const usesTable = Boolean(entry.usesTableState);

  const helpers = ['ChartsProvider', entry.exportName as string];
  if ([...usedFields].some((s) => s === 'category' || s === 'group' || s === 'time')) helpers.push('dimension');
  if ([...usedFields].some((s) => s === 'primary' || s === 'secondary' || s === 'size')) helpers.push('measure');
  if (settings.dataState === 'ready' || settings.dataState === 'empty') helpers.push('results');

  const lines: string[] = [];
  if (usesGranularity || usesTable) lines.push(`import { useState } from 'react';`);
  lines.push(`import { ${helpers.join(', ')} } from '${BRAND.packageName}';`);
  if (usesGranularity) lines.push(`import type { Granularity } from '${BRAND.packageName}';`);
  lines.push('');

  const slots: FieldSlot[] = ['category', 'group', 'primary', 'secondary', 'size'];
  for (const slot of slots) {
    if (!usedFields.has(slot)) continue;
    const kind = slot === 'category' || slot === 'group' ? 'dimension' : 'measure';
    const spec = ds.specs[slot];
    if (lines.some((l) => l.startsWith(`const ${spec.varName} =`))) continue;
    lines.push(printField(spec, kind));
  }
  if (!usesGranularity && usedFields.has('time')) lines.push(printField(ds.specs.time, 'dimension', "granularity: 'month'"));
  hoisted.forEach((h) => lines.push(h));

  if (hasTheme) {
    lines.push('');
    lines.push('const theme = {');
    if (Object.keys(preset.styles).length) {
      lines.push('  styles: {');
      Object.entries(preset.styles).forEach(([k, v]) => lines.push(`    '${k}': '${v}',`));
      lines.push('  },');
    }
    if (language.id !== 'en') {
      const fieldNames = [...usedFields].map((slot) => ({
        name: ds.specs[slot].name,
        kind: (slot === 'primary' || slot === 'secondary' || slot === 'size' ? 'measure' : 'dimension') as
          | 'measure'
          | 'dimension',
      }));
      const content = snippetTranslations(ds, entry.id, fieldNames, language.id);
      lines.push('  i18n: {');
      lines.push(`    language: '${language.id}',`);
      if (content) {
        lines.push('    // Your own strings: titles use "key|fallback"; fields and values resolve by name.');
        lines.push(`    translations: ${printNested({ [language.id]: { translation: content } }, 2)},`);
      }
      lines.push('  },');
      lines.push(`  formatter: { locale: '${language.locale}' },`);
    }
    lines.push('};');
  }

  lines.push('');
  const rowNames = [...rowVars.keys()].filter((n) => n !== 'pageRows');
  const signature =
    usesGranularity || usesTable || rowNames.length === 0
      ? ''
      : `{ ${rowNames.join(', ')} }: { ${rowNames.map((n) => `${n}: Row[]`).join('; ')} }`;

  if (rowNames.length && !usesGranularity) lines.push('type Row = Record<string, unknown>;', '');
  rowVars.forEach((data, name) => {
    if (!usesGranularity && !usesTable) lines.push(sampleComment(name, data));
  });

  lines.push(`export function MyChart(${signature}) {`);
  if (usesGranularity) {
    lines.push(`  const [granularity, setGranularity] = useState<Granularity>('month');`);
    lines.push(`  ${printField(ds.specs.time, 'dimension', 'granularity')}`);
    lines.push('  // Your data hook: re-query whenever the granularity changes.');
    if (settings.dataState === 'ready') {
      lines.push(`  const rows = useRows({ granularity });`);
      const data = rowVars.get('rows');
      if (data) lines.push(`  ${sampleComment('rows', data)}`);
    }
  }
  if (usesTable) {
    lines.push(`  const [state, setState] = useState({ page: 0, isLoadingDownloadData: false });`);
    lines.push('  // Your data hook: fetch one sorted page. pageSize is measured from the available height.');
    lines.push('  const { pageRows, total } = usePagedRows({ page: state.page, pageSize: state.pageSize, sort: state.sort });');
  }

  lines.push('  return (');
  lines.push(`    <ChartsProvider${hasTheme ? ' theme={theme}' : ''}>`);
  lines.push(`      <${entry.exportName}`);
  Object.entries(rawProps).forEach(([k, v]) => {
    const printed = printProp(k, v);
    if (printed) lines.push(`        ${printed}`);
  });
  lines.push('      />');
  lines.push('    </ChartsProvider>');
  lines.push('  );');
  lines.push('}');

  return lines.join('\n');
};
