import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as library from '../src';
import { componentDefaults } from '../src/componentDefaults.generated';
import { buildChart, ChartRuntime, ChartSettings, cutRows, MAX_PRINTED_ROWS } from '../site/catalog/build';
import { datasets, Row } from '../site/catalog/datasets';
import { MAX_WIDTH, WIDTH } from '../site/catalog/format';
import { ChartEntry, chartEntries, DataState } from '../site/catalog/registry';
import { themePresets } from '../site/catalog/themes';
import { BRAND } from '../site/config';
import { componentExamples, EXCERPT_LINES, exampleCode, exampleView, helperComment } from '../site/content/components';

// "Every code example runs as pasted" (site/STANDARDS.md, C). Each example the
// site generates, for every component, preset and data state, is checked as a
// reader would use it: it has no placeholder text, it type-checks as a module
// of its own against the library's real types, it renders when executed, and
// its props and rows agree with what the preview next to it is given.

type Base = Pick<ChartSettings, 'themeId' | 'languageId' | 'datasetId'>;
type Sample = {
  id: string;
  entry: ChartEntry;
  settings: ChartSettings;
  runtime: ChartRuntime;
  code: string;
  isDefault: boolean;
  file: string;
};

const pkg = BRAND.packageName;
const english: Base = { themeId: 'default', languageId: 'en', datasetId: 'saas' };
const dataStates: DataState[] = ['ready', 'loading', 'empty', 'error'];
const root = process.cwd();

const runtime: ChartRuntime = {
  granularity: 'month',
  setGranularity: () => {},
  tableState: { page: 0, isLoadingDownloadData: false },
  setTableState: () => {},
  onEvent: () => {},
};
const fileFor = (id: string) => `${root}/tests/.examples/${id.replace(/[^A-Za-z0-9]+/g, '-')}.tsx`;

const samplesFor = (base: Base, states: DataState[], tag = '') =>
  chartEntries.flatMap((entry) =>
    componentExamples(entry).flatMap((example, index) =>
      states.map((dataState): Sample => {
        const id = `${entry.id} / ${example.id} / ${dataState}${tag}`;
        return {
          id,
          entry,
          settings: { ...base, toggles: {}, dataState, variantId: example.variantId, overrides: example.overrides },
          runtime,
          code: exampleCode(entry, { ...example, dataState }, base),
          isDefault: index === 0 && dataState === 'ready',
          file: fileFor(id),
        };
      }),
    ),
  );

// Every component × preset × data state in English, as the Markdown twins and
// the docs pages print them; then the settings a visitor can change.
const samples = samplesFor(english, dataStates);
const defaults = (list: Sample[]) => list.filter((s) => s.isDefault);
const variations = [
  ...samplesFor({ ...english, datasetId: 'web' }, ['ready'], ' (web data)'),
  ...samplesFor({ ...english, datasetId: 'retail' }, ['ready'], ' (retail data)'),
  ...defaults(samplesFor({ ...english, languageId: 'de' }, ['ready'], ' (German)')),
  // A theme prints the same for every component: three components each is enough.
  ...themePresets.flatMap((theme) => defaults(samplesFor({ ...english, themeId: theme.id }, ['ready'], ` (${theme.id} theme)`)).slice(0, 3)),
];

// The playground prints from the same generator with a visitor's own settings:
// every switch flipped, a title that needs escaping, a field option added, a
// weekly granularity picked in the preview and a table sorted and paged.
const playground = chartEntries.map((entry): Sample => {
  const id = `${entry.id} / playground`;
  const settings: ChartSettings = {
    ...english,
    dataState: 'ready',
    toggles: Object.fromEntries(entry.toggles.filter((t) => t.key !== 'hideMenu').map((t) => [t.key, !t.default])),
    overrides: { title: 'Sales "by" region & plan' },
    fieldOverrides: { measures: { decimalPlaces: 1 }, measure: { decimalPlaces: 1 } },
  };
  const played: ChartRuntime = {
    ...runtime,
    granularity: 'week',
    tableState: {
      page: 0,
      pageSize: 3,
      sort: { id: Object.keys(datasets.saas.byCategory[0]!)[0]!, direction: 'desc' },
      isLoadingDownloadData: false,
    },
  };
  return { id, entry, settings, runtime: played, code: buildChart(entry, settings, played).code, isDefault: false, file: fileFor(id) };
});

const all = [...samples, ...variations, ...playground];
const table = (list: Sample[]) => list.map((sample) => [sample.id, sample] as const);

// ---- One TypeScript program over every example, each a file of its own -------

const config = ts.getParsedCommandLineOfConfigFile(`${root}/tsconfig.json`, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  },
})!;
const options: ts.CompilerOptions = {
  ...config.options,
  strict: true,
  noEmit: true,
  // The package name, as the examples import it, is the library's source entry.
  baseUrl: root,
  paths: { [pkg]: ['src/index.ts'] },
};
const virtual = new Map(all.map((sample) => [sample.file, sample.code]));
const host = ts.createCompilerHost(options);
const { fileExists, readFile, getSourceFile } = host;
host.fileExists = (file) => virtual.has(file) || fileExists(file);
host.readFile = (file) => virtual.get(file) ?? readFile(file);
host.getSourceFile = (file, languageVersion, ...rest) =>
  virtual.has(file)
    ? ts.createSourceFile(file, virtual.get(file)!, languageVersion, true, ts.ScriptKind.TSX)
    : getSourceFile(file, languageVersion, ...rest);
const program = ts.createProgram([...virtual.keys()], options, host);

const report = (sample: Sample, diagnostics: readonly ts.Diagnostic[]) =>
  diagnostics
    .map((d) => {
      const at = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : undefined;
      return `${sample.id}, line ${at ? at.line + 1 : '?'}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
    })
    .concat(diagnostics.length ? [sample.code] : [])
    .join('\n');

// ---- Reading an example back ------------------------------------------------

const literalOf = (node: ts.Expression, names: Map<string, ts.Expression> = new Map()): unknown => {
  const of = (child: ts.Expression) => literalOf(child, names);
  if (ts.isIdentifier(node) && names.has(node.text)) return of(names.get(node.text)!);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -Number((node.operand as ts.NumericLiteral).text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(of);
  if (ts.isObjectLiteralExpression(node)) {
    return Object.fromEntries(
      node.properties.filter(ts.isPropertyAssignment).map((p) => [(p.name as ts.Identifier | ts.StringLiteral).text, of(p.initializer)]),
    );
  }
  return undefined;
};

/** The chart's attributes that are plain values, and the module's arrays of rows. */
const read = (sample: Sample) => {
  const source = program.getSourceFile(sample.file)!;
  const attributes: Record<string, unknown> = {};
  const rowSets: Record<string, Record<string, unknown>[]> = {};
  const imports: string[] = [];
  let theme: unknown;
  // Top-level constants, so a value that names one (`translation: strings`) reads as what it holds.
  const names = new Map<string, ts.Expression>();
  ts.forEachChild(source, (node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const d of node.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) names.set(d.name.text, d.initializer);
  });
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) imports.push((node.moduleSpecifier as ts.StringLiteral).text);
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === String(sample.entry.exportName)) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue;
        const { initializer } = attribute;
        const value = !initializer
          ? true
          : ts.isStringLiteral(initializer)
            ? initializer.text
            : ts.isJsxExpression(initializer) && initializer.expression
              ? literalOf(initializer.expression, names)
              : undefined;
        attributes[attribute.name.getText()] = value;
      }
    }
    if (ts.isVariableDeclaration(node) && node.name.getText() === 'theme' && node.initializer) theme = literalOf(node.initializer, names);
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      const rows = literalOf(node.initializer) as unknown[];
      if (rows.length && rows.every((row) => typeof row === 'object' && row !== null && !Array.isArray(row))) {
        rowSets[node.name.getText()] = rows as Record<string, unknown>[];
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { attributes, rowSets, imports, theme };
};

type Strings = { [key: string]: string | Strings };
// As i18next resolves a key: a path of dotted parts, any of which may itself hold dots.
const translationOf = (strings: Strings | string | undefined, key: string): string | undefined => {
  if (typeof strings !== 'object') return undefined;
  const parts = key.split('.');
  for (let i = parts.length; i > 0; i--) {
    const found = strings[parts.slice(0, i).join('.')];
    if (i === parts.length) {
      if (typeof found === 'string') return found;
    } else {
      const deeper = translationOf(found, parts.slice(i).join('.'));
      if (deeper !== undefined) return deeper;
    }
  }
  return undefined;
};

const previewProps = (sample: Sample) => buildChart(sample.entry, sample.settings, sample.runtime).props;
const escaped = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const defaultsOf = (sample: Sample) =>
  (componentDefaults as Record<string, Record<string, unknown>>)[String(sample.entry.exportName)] ?? {};
const isScalar = (value: unknown) => ['string', 'number', 'boolean'].includes(typeof value);
// "key|fallback" is a translation key; without a translation the chart shows the fallback.
const shown = (value: unknown) => (typeof value === 'string' && value.includes('|') ? value.split('|', 2)[1] : value);

// ---- Running an example -----------------------------------------------------

const modules: Record<string, unknown> = { react: React, 'react/jsx-runtime': jsxRuntime, [pkg]: library };

/** The module, executed: its exports, and any of its top-level names asked for. */
const evaluate = (code: string, expose: string[] = []) => {
  const js = ts.transpileModule(`${code}\n${expose.map((name) => `export const __${name} = ${name};`).join('\n')}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exported: Record<string, unknown> & { Example?: React.ComponentType } = {};
  const load = (name: string) => {
    if (!(name in modules)) throw new Error(`The example imports "${name}", which a reader's project would not have.`);
    return modules[name];
  };
  new Function('require', 'exports', js)(load, exported);
  return exported;
};

const run = (sample: Sample) => {
  const js = ts.transpileModule(sample.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exported: { Example?: React.ComponentType } = {};
  const load = (name: string) => {
    if (!(name in modules)) throw new Error(`The example imports "${name}", which a reader's project would not have.`);
    return modules[name];
  };
  new Function('require', 'exports', js)(load, exported);
  if (!exported.Example) throw new Error('The example does not export `Example`.');
  return renderToString(React.createElement(exported.Example));
};

// ---- The checks --------------------------------------------------------------

describe('generated examples', () => {
  it('cover every component, preset and data state', () => {
    expect(samples.length).toBe(chartEntries.reduce((n, entry) => n + componentExamples(entry).length, 0) * dataStates.length);
    expect(new Set(all.map((s) => s.file)).size).toBe(all.length);
  });

  it.each(table(samples))('%s has no placeholder, leaked key or undefined helper', (_, { code }) => {
    expect(code).not.toContain('…');
    // Three dots are fine as a spread (`...revenue`), never as an elision.
    expect(code).not.toMatch(/\.\.\.(?![A-Za-z_$[({])/);
    expect(code).not.toContain('titles.');
    expect(code).not.toMatch(/["'][A-Za-z][\w-]*(\.[\w-]+)+\|/);
    expect(code).not.toContain('useRows');
    expect(code).not.toContain('usePagedRows');
    expect(code).not.toContain('// rows:');
    expect(code).not.toMatch(/\bTODO\b|your data hook/i);
  });

  it.each(table(all))('%s parses as TSX and type-checks against the library', (_, sample) => {
    const source = program.getSourceFile(sample.file)!;
    expect(report(sample, program.getSyntacticDiagnostics(source))).toBe('');
    expect(report(sample, program.getSemanticDiagnostics(source))).toBe('');
  });

  it.each(table(all))('%s is a module of its own: it imports only React and the package, and renders', (_, sample) => {
    const { imports } = read(sample);
    expect(imports.filter((name) => name !== 'react' && name !== pkg)).toEqual([]);
    expect(sample.code).toContain('<ChartsProvider');
    // A chart fills its container, so the container has a height, unless the table sizes itself.
    // A preset about a small card (the funnel's) gives it a width too.
    expect(/<div style=\{\{ (width: \d+, )?height: \d+ \}\}>/.test(sample.code) || sample.code.includes('heightMode="auto"'), sample.code).toBe(true);
    const html = run(sample);
    const title = shown(previewProps(sample).title);
    if (typeof title === 'string' && sample.settings.languageId === 'en') expect(html).toContain(escaped(title));
    expect(html.length).toBeGreaterThan(200);
  });

  it.each(table(all))('%s sets what the preview sets, and nothing that is already the default', (_, sample) => {
    const { attributes } = read(sample);
    const props = previewProps(sample);
    const defaults = defaultsOf(sample);
    const effective = (given: Record<string, unknown>, key: string) => given[key] ?? defaults[key] ?? false;
    const translated = sample.settings.languageId !== 'en';

    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined) continue;
      expect(key in defaults && JSON.stringify(defaults[key]) === JSON.stringify(value), `${key} is printed but equals the default`).toBe(false);
    }
    for (const key of new Set([...Object.keys(props), ...Object.keys(attributes)])) {
      const inPreview = effective(props, key);
      if (!isScalar(inPreview)) continue;
      const inCode = effective(attributes, key);
      expect(translated ? inCode : shown(inCode), `${key}: preview and code disagree\n${sample.code}`).toEqual(translated ? inPreview : shown(inPreview));
    }
  });

  // What you paste is what you saw: the preview is handed the very rows the
  // code prints, all of them up to MAX_PRINTED_ROWS (site/STANDARDS.md, B).
  it.each(table(all.filter((s) => s.settings.dataState === 'ready')))('%s prints exactly the rows its preview draws', (_, sample) => {
    const { rowSets } = read(sample);
    const props = previewProps(sample);
    const fieldNames = Object.values(props)
      .flat()
      .filter((v): v is { name: string } => typeof v === 'object' && v !== null && '__type__' in v)
      .map((field) => field.name);
    const drawn = Object.entries(props).flatMap(([prop, value]) => {
      const data = (value as { data?: unknown } | undefined)?.data;
      return Array.isArray(data) && data.length ? [[prop, data as Row[]] as const] : [];
    });
    expect(drawn.length).toBeGreaterThan(0);

    // A picker example prints rows by day and the query that sums them: the preview draws that sum.
    if (sample.code.includes('rowsBy(')) {
      const { __rowsBy } = evaluate(sample.code, ['rowsBy']) as { __rowsBy: (g: string) => Row[] };
      expect(Object.keys(rowSets)).toEqual([]);
      expect(drawn).toEqual([['results', __rowsBy(sample.runtime.granularity)]]);
      return;
    }

    const sets = Object.values(rowSets) as Row[][];
    const stateful = sample.code.includes('useState<');
    for (const rows of sets) {
      expect(rows.length).toBeLessThanOrEqual(MAX_PRINTED_ROWS);
      for (const row of rows) {
        // Only keys the chart's fields read: the field's name, or name.<granularity>.
        for (const key of Object.keys(row)) {
          expect(fieldNames.some((field) => key === field || key.startsWith(`${field}.`)), `${key} is not a field of the chart`).toBe(true);
        }
      }
    }
    for (const [prop, rows] of drawn) {
      if (!stateful) {
        // A chart draws one printed set, whole and in order.
        expect(sets, `${prop} draws rows the code does not print:\n${sample.code}`).toContainEqual(rows);
        continue;
      }
      // A table draws a page, or every row for its downloads: always rows of the printed set.
      const printed = sets[0]!;
      for (const row of rows) expect(printed, `${prop} draws a row the code does not print`).toContainEqual(row);
      if (prop === 'allResults') expect(rows.length).toBe(printed.length);
    }
    // And nothing is printed that the preview does not draw.
    for (const rows of sets) {
      expect(drawn.some(([, data]) => rows.every((row) => data.some((d) => JSON.stringify(d) === JSON.stringify(row)))), JSON.stringify(rows)).toBe(true);
    }
  });

  it('cuts only past MAX_PRINTED_ROWS, and then between whole runs of the first key', () => {
    const rows = (n: number, per = 3) => Array.from({ length: n }, (_, i) => ({ region: `R${Math.floor(i / per)}`, value: i }));
    expect(cutRows(rows(15))).toHaveLength(15);
    expect(cutRows(rows(12))).toHaveLength(12);
    expect(cutRows(rows(18))).toHaveLength(15);
    expect(cutRows(rows(20, 4))).toHaveLength(12);
  });

  it('the review’s cases print what their previews draw: every point of the scatter, every region of the pivot', () => {
    const counts = (id: string) => {
      const sample = samples.find((s) => s.id === `${id} / usage / ready`)!;
      const printed = Object.values(read(sample).rowSets)[0]!.length;
      const drawn = ((previewProps(sample).results as { data: unknown[] }).data ?? []).length;
      return { printed, drawn };
    };
    expect(counts('scatter')).toEqual({ printed: datasets.saas.byPoint.length, drawn: datasets.saas.byPoint.length });
    expect(counts('pivot')).toEqual({ printed: datasets.saas.byCategoryGroup.length, drawn: datasets.saas.byCategoryGroup.length });
  });

  it.each(table(samples.filter((s) => s.settings.dataState !== 'ready')))('%s passes its state in full', (_, sample) => {
    const expected = {
      loading: 'results={{ isLoading: true }}',
      empty: 'results={results([])}',
      error: "results={{ isLoading: false, error: 'The query timed out after 30 seconds.' }}",
    }[sample.settings.dataState as 'loading' | 'empty' | 'error'];
    // As one line, whether or not the printer broke it.
    expect(sample.code.replace(/,(\s*[}\]])/g, '$1').replace(/\s+/g, ' ')).toContain(expected);
  });

  it.each(table(all.filter((s) => s.settings.languageId !== 'en')))('%s carries a translation for every key it uses', (_, sample) => {
    const { attributes, theme } = read(sample);
    const language = sample.settings.languageId;
    const i18n = (theme as { i18n?: { language?: string; translations?: Record<string, { translation?: Strings }> } } | undefined)?.i18n;
    expect(i18n?.language).toBe(language);
    const keys = Object.values(attributes).filter((v): v is string => typeof v === 'string' && v.includes('|'));
    expect(keys.length).toBeGreaterThan(0);
    for (const value of keys) {
      const key = value.split('|', 2)[0]!;
      expect(translationOf(i18n?.translations?.[language]?.translation, key), `${key} has no ${language} translation in\n${sample.code}`).toBeTypeOf('string');
    }
  });

  it('prints no theme for the library look or the look the site opens with, and a short one otherwise', () => {
    for (const sample of variations.filter((s) => s.id.endsWith('theme)'))) {
      const themed = !['default', 'studio'].includes(sample.settings.themeId);
      expect(sample.code.includes('const theme'), sample.id).toBe(themed);
      expect(sample.code.includes('<ChartsProvider theme={theme}>'), sample.id).toBe(themed);
    }
  });
});

// Width and length (site/STANDARDS.md, D). Every line of every example fits
// MAX_WIDTH, whatever the component, preset, state, data set, language or
// theme; past WIDTH there is only a row of sample data, which reads best on
// one line. On the page, every example after the usage example is an excerpt
// of EXCERPT_LINES or so, with the whole module a click away.

const views = chartEntries.flatMap((entry) =>
  componentExamples(entry).map((example) => ({ id: `${entry.id} / ${example.id}`, entry, example, view: exampleView(entry, example, english) })),
);

describe('example width and length', () => {
  it.each(table(all))('%s has no line wider than MAX_WIDTH, and only data past WIDTH', (_, sample) => {
    for (const line of sample.code.split('\n')) {
      expect(line.length, line).toBeLessThanOrEqual(MAX_WIDTH);
      // Past WIDTH only what Prettier cannot break either: a row of sample data, or one string.
      if (line.length > WIDTH) expect(line, 'only a row of sample data or a lone string runs past WIDTH').toMatch(/^ {2}\{ .* \},$|^ *('[^']*': )?'[^']*'[,;]$/);
    }
  });

  it('prints no granularity-picker comment, and wires the picker only in the example about it', () => {
    for (const sample of all) {
      expect(sample.code).not.toContain('A granularity picker needs');
      expect(sample.code.includes('showGranularityDropdown')).toBe(sample.id.startsWith('line / granularity-picker'));
    }
  });

  it.each(views.map((v) => [v.id, v] as const))('%s: the page shows a short excerpt of the module it copies', (_, { entry, example, view }) => {
    expect(view.code).toBe(exampleCode(entry, example, english));
    if (example.id === 'usage') {
      // The usage example is whole and visible.
      expect(view.excerpt).toBeUndefined();
      return;
    }
    const excerpt = view.excerpt!;
    const lines = excerpt.code.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(6);
    expect(lines.length).toBeLessThanOrEqual(EXCERPT_LINES + 3);
    // Every line is a line of the module (indented less, perhaps): an excerpt, not new code.
    // The one exception names a helper the excerpt calls, by a signature the module declares.
    const full = new Set(view.code.split('\n').map((line) => line.trim()));
    for (const line of lines) {
      const helper = line.match(/^\/\/ (\w+)\(([^)]*)\): in the full code\.$/);
      if (helper) expect(view.code, line).toMatch(new RegExp(`const ${helper[1]} = \\(${helper[2]!.replace(/[()[\]|.*+?]/g, '\\$&')}\\)`));
      else expect(full.has(line.trim()), line).toBe(true);
    }
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(MAX_WIDTH);
    // Highlights point at real lines.
    for (const i of excerpt.marked) expect(lines[i]!.trim()).not.toBe('');
    for (const i of view.marked) expect(view.code.split('\n')[i]!.trim()).not.toBe('');
  });

  it('keeps nearly every excerpt within EXCERPT_LINES', () => {
    const excerpts = views.flatMap((v) => (v.view.excerpt ? [v.view.excerpt.code.split('\n').length] : []));
    const over = excerpts.filter((n) => n > EXCERPT_LINES);
    expect(over.length, `${over.length} of ${excerpts.length} excerpts are over ${EXCERPT_LINES} lines`).toBeLessThanOrEqual(2);
    const median = [...excerpts].sort((a, b) => a - b)[Math.floor(excerpts.length / 2)]!;
    expect(median).toBeLessThanOrEqual(16);
  });

  it('highlights what an example changes: the prop it is about', () => {
    const view = views.find((v) => v.id === 'bar / axis-titles')!.view;
    const marked = view.excerpt!.marked.map((i) => view.excerpt!.code.split('\n')[i]!.trim());
    expect(marked).toEqual(expect.arrayContaining(['xAxisLabel="Industry"', 'yAxisLabel="Customers"']));
    expect(marked).not.toContain('dimension={industry}');
  });
});

// The line chart's purpose is its granularity picker: one example wires it,
// and it runs as pasted, re-bucketing its own rows for the period picked.
describe('granularity picker example', () => {
  const entry = chartEntries.find((e) => e.id === 'line')!;
  const example = componentExamples(entry).find((e) => e.id === 'granularity-picker')!;
  const code = exampleCode(entry, example, english);

  it('names the helper its excerpt calls, with its signature', () => {
    const view = exampleView(entry, example, english);
    expect(view.excerpt!.code).toContain(helperComment('rowsBy', 'granularity: Granularity'));
  });

  it('wires the picker with state, as the props table says', () => {
    for (const part of ['useState', 'setGranularity={setGranularity}', 'showGranularityDropdown: true', 'dateBounds', 'granularity }']) {
      expect(code).toContain(part);
    }
  });

  it.each(['week', 'month', 'quarter'] as const)('draws the same rows as its preview at %s', (granularity) => {
    const settings: ChartSettings = { ...english, dataState: 'ready', toggles: {}, variantId: example.variantId };
    const preview = buildChart(entry, settings, { ...runtime, granularity }).props;
    const { __rowsBy } = evaluate(code, ['rowsBy']) as { __rowsBy: (g: string) => Row[] };
    expect((preview.results as { data: Row[] }).data).toEqual(__rowsBy(granularity));
    expect((preview.xAxis as { inputs: { granularity: string } }).inputs.granularity).toBe(granularity);
    // Whole periods: weeks of seven days, months and quarters that add up to the same total.
    const total = (rows: Row[]) => rows.reduce((sum, row) => sum + Number(Object.values(row)[1]), 0);
    expect(total(__rowsBy(granularity))).toBe(total(__rowsBy('week')));
  });

  it('offers week, month and quarter in the card, from the range it sets', async () => {
    const { __startDate } = evaluate(code, ['startDate']) as { __startDate: { inputs: { dateBounds: { from: Date; to: Date } } } };
    const days = (__startDate.inputs.dateBounds.to.getTime() - __startDate.inputs.dateBounds.from.getTime()) / 86_400_000;
    // The picker lists a granularity with 1 to 100 periods in the range: not days, not years.
    expect(days).toBeGreaterThan(100);
    expect(days / 90).toBeGreaterThanOrEqual(1);
    expect(days / 365).toBeLessThan(1);
  });

  it('renders as pasted, picker included', () => {
    const html = renderToString(React.createElement(evaluate(code).Example!));
    expect(html).toContain('GranularitySelectField');
  });
});
