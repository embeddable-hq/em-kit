import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { chartEntries } from '../site/catalog/registry';
import { typeShapes } from '../site/content/components';
import { typeDefinitions } from '../site/generated/props';

// Every type shape a component page prints (event payloads, controlled state,
// `Granularity`, `TimeRange`) is the exported type, exactly: compiled against
// the package with an identity check, so `x?: T` where the package says
// `x: T | undefined` fails. The review that asked for this found 13 of 16
// printed shapes were not even assignable to their exports.
// site:check runs the same check over the published Markdown.

const root = join(__dirname, '..');
const GLOBALS = new Set(['Date', 'Record', 'Partial', 'Array']);

// name -> definition, from every page; one name always has one definition.
const shapes = new Map<string, { definition: string; pages: string[] }>();
for (const entry of chartEntries) {
  for (const shape of typeShapes(entry)) {
    const at = shape.indexOf(' = ');
    const name = shape.slice(0, at);
    const definition = shape.slice(at + 3);
    const seen = shapes.get(name);
    if (seen) {
      expect(seen.definition, `${name} is printed two ways`).toBe(definition);
      seen.pages.push(entry.id);
    } else shapes.set(name, { definition, pages: [entry.id] });
  }
}
for (const [name, definition] of Object.entries(typeDefinitions)) if (!shapes.has(name)) shapes.set(name, { definition, pages: [] });

/** A module that holds each printed shape against its export; one diagnostic per shape that differs. */
export const exactCheckSource = (printed: [name: string, definition: string][], from: string) => {
  const referenced = new Set(printed.flatMap(([, definition]) => [...definition.replace(/"[^"]*"/g, '').matchAll(/\b[A-Z]\w*\b/g)].map((m) => m[0])));
  const imports = [...referenced].filter((name) => !GLOBALS.has(name));
  return [
    `import type * as Package from '${from}';`,
    imports.length ? `import type { ${imports.join(', ')} } from '${from}';` : '',
    // Identical types, after an intersection (`A & { b }`) is read as the one
    // object it is: Flat keeps every key's optionality and type.
    'type Flat<T> = { [K in keyof T]: T[K] };',
    'type Exact<A, B> = (<T>() => T extends Flat<A> ? 1 : 2) extends (<T>() => T extends Flat<B> ? 1 : 2) ? true : false;',
    ...printed.flatMap(([name, definition], i) => [
      `namespace Printed${i} { export type ${name} = ${definition}; }`,
      `export const shape${i}: Exact<Printed${i}.${name}, Package.${name}> = true;`,
    ]),
  ].join('\n');
};

const compile = (source: string) => {
  const file = join(root, 'tests/.shapes/check.ts');
  const config = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} })!;
  const options = { ...config.options, noEmit: true, noUnusedLocals: false };
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = host;
  host.fileExists = (f) => f === file || fileExists(f);
  host.readFile = (f) => (f === file ? source : readFile(f));
  host.getSourceFile = (f, ...rest) => (f === file ? ts.createSourceFile(f, source, rest[0], true) : getSourceFile(f, ...rest));
  const program = ts.createProgram([file], options, host);
  const sourceFile = program.getSourceFile(file)!;
  return [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)].map((d) => {
    const line = d.start === undefined ? -1 : sourceFile.getLineAndCharacterOfPosition(d.start).line;
    return { line: source.split('\n')[line] ?? '', message: ts.flattenDiagnosticMessageText(d.messageText, ' ') };
  });
};

describe('printed type shapes', () => {
  const printed = [...shapes].map(([name, { definition }]) => [name, definition] as [string, string]);

  it('covers the payloads, the table states and the hand-written types', () => {
    const names = printed.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining(['BarChartOptionsClickArg', 'TablePaginatedState', 'Granularity', 'TimeRange']));
    expect(names.length).toBeGreaterThanOrEqual(16);
  });

  it('every shape is its export, exactly', { timeout: 30_000 }, () => {
    const problems = compile(exactCheckSource(printed, '../../src')).map((d) => `${d.line}\n  ${d.message}`);
    expect(problems).toEqual([]);
  });

  it('the check catches a shape that only looks right', { timeout: 30_000 }, () => {
    const wrong = compile(
      exactCheckSource(
        [
          // The old pages' shapes: optional where the package says "present, maybe undefined".
          ['BarChartOptionsClickArg', '{ dimensionValue?: string | number; dimensionTimeRange: TimeRange; }'],
          ['TimeRange', '{ from: Date; to: Date; relativeTimeString: string }'],
          // A key short.
          ['BubbleChartOptionsClickArg', '{ xMeasureValue: string; yMeasureValue: string; pointDimensionValue: string | undefined; groupByDimensionValue: string | null | undefined; pointDimensionTimeRange: TimeRange; groupByDimensionTimeRange: TimeRange; }'],
        ],
        '../../src',
      ),
    );
    expect(wrong).toHaveLength(3);
  });
});
