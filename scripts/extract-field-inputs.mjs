#!/usr/bin/env node
// Extracts the per-field options (Embeddable "sub-inputs": prefix, suffix,
// decimalPlaces, columnAggregation, …) that each remarkable-pro chart accepts
// on its dimensions and measures. The source of truth is the chart's
// definition.ts, which sync.mjs otherwise drops; this bundles and evaluates
// those files against stubbed Embeddable modules and records the result.
//
//   node scripts/extract-field-inputs.mjs [remarkable-pro/src dir]

import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIELD_INPUTS_OUT = path.join(ROOT, 'src/fieldInputs.generated.json');

// Every name imported from an Embeddable module becomes a callable proxy,
// except defineType/defineOption, which record type names and their options
// so enums survive extraction.
const embeddableStub = (names) => `
const anything = new Proxy(function () {}, {
  get: (_t, prop) => (prop === Symbol.toPrimitive ? () => '' : anything),
  apply: () => anything,
  construct: () => anything,
});
export const defineType = (typeName) => ({ __fieldInputType: typeName, options: [] });
export const defineOption = (type, option) => {
  if (type && Array.isArray(type.options)) type.options.push(option);
};
export default anything;
${names.map((n) => `export const ${n} = anything;`).join('\n')}
`;

const importedEmbeddableNames = (files) => {
  const names = new Set();
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    for (const m of code.matchAll(/import\s+(?:type\s+)?(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]@embeddable\.com\/[^'"]+['"]/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
        if (name) names.add(name);
      }
    }
  }
  names.delete('defineType');
  names.delete('defineOption');
  return [...names].sort();
};

const stubPlugin = (stubNames) => ({
  name: 'stub-embeddable',
  setup(b) {
    b.onResolve({ filter: /^@embeddable\.com\// }, () => ({ path: 'embeddable', namespace: 'stub' }));
    // The chart component itself is irrelevant to its metadata.
    b.onResolve({ filter: /^\.\/index$/ }, (args) =>
      /(^|[\\/])definition\.ts$/.test(args.importer) ? { path: 'component', namespace: 'stub' } : undefined,
    );
    b.onResolve({ filter: /\.(css|svg|png)$/ }, () => ({ path: 'asset', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => ({
      contents: args.path === 'embeddable' ? embeddableStub(stubNames) : 'export default {};',
      loader: 'js',
    }));
  },
});

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });

const FIELD_TYPES = new Set(['dimension', 'measure', 'dimensionOrMeasure']);

const describeType = (type) =>
  typeof type === 'string' ? { type } : { type: type.__fieldInputType, options: [...type.options] };

const describeSubInput = (sub) => {
  const out = { name: sub.name, label: sub.label, ...describeType(sub.type) };
  if (sub.description) out.description = sub.description;
  if (sub.array) out.array = true;
  if (sub.supportedTypes) out.supportedTypes = [...sub.supportedTypes];
  if (sub.defaultValue !== undefined) out.defaultValue = sub.defaultValue;
  return out;
};

// Bundles and evaluates every chart's definition.ts; returns each one's
// directory (relative to src/, as the component manifest spells it) and meta.
export const extractDefinitionMetas = async (proSrcRoot) => {
  const chartsDir = path.join(proSrcRoot, 'components/charts');
  const definitions = walk(chartsDir).filter((f) => /(^|[\\/])definition\.ts$/.test(f)).sort();

  const entry = definitions
    .map((file, i) => `export * as d${i} from ${JSON.stringify(file)};`)
    .join('\n');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'charts-ui-field-inputs-'));
  const outfile = path.join(tmp, 'definitions.mjs');
  try {
    await build({
      stdin: { contents: entry, resolveDir: proSrcRoot, loader: 'ts' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'error',
      jsx: 'automatic',
      external: ['react', 'react-dom', 'react/*'],
      // The upstream source is extracted to a temp dir with no node_modules;
      // its npm dependencies are carried in this package.
      nodePaths: [path.join(ROOT, 'node_modules')],
      plugins: [stubPlugin(importedEmbeddableNames(walk(proSrcRoot).filter((f) => /\.tsx?$/.test(f))))],
    });
    const mod = await import(pathToFileURL(outfile).href);
    return definitions.map((file, i) => {
      const exported = Object.values(mod[`d${i}`]).find((v) => v && typeof v === 'object' && v.meta);
      if (!exported) throw new Error(`No exported definition with meta in ${file}`);
      const dir = path.relative(proSrcRoot, path.dirname(file)).split(path.sep).join('/');
      return { path: dir, meta: exported.meta };
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

export const extractFieldInputs = async (proSrcRoot, metas) => {
  const result = {};
  for (const { meta } of metas ?? (await extractDefinitionMetas(proSrcRoot))) {
      const fields = {};
      for (const input of meta.inputs ?? []) {
        if (!FIELD_TYPES.has(input.type)) continue;
        fields[input.name] = {
          kind: input.type,
          label: input.label,
          ...(input.array ? { array: true } : {}),
          ...(input.required === false ? { required: false } : {}),
          inputs: (input.inputs ?? []).map(describeSubInput),
        };
      }
      result[meta.name] = { label: meta.label, fields };
  }
  return result;
};

export const BUILDER_DEFAULTS_OUT = path.join(ROOT, 'src/builderDefaults.generated.json');

// Each chart's builder input defaults, keyed by its directory: what Embeddable
// passes for every input the author leaves unset. Fields and the dataset are
// data, not settings, so they are left out. scripts/exports.mjs keeps the
// ones that are props and applies them.
export const builderDefaults = (metas) => {
  const result = {};
  for (const { path: dir, meta } of metas) {
    const defaults = {};
    for (const input of meta.inputs ?? []) {
      if (input.defaultValue === undefined || FIELD_TYPES.has(input.type) || input.type === 'dataset') continue;
      defaults[input.name] = input.defaultValue;
    }
    result[dir] = defaults;
  }
  return result;
};

export const writeBuilderDefaults = (data, outFile = BUILDER_DEFAULTS_OUT) =>
  fs.writeFileSync(outFile, `${JSON.stringify(data, null, 2)}\n`);

export const FIELD_INPUTS_TYPES_OUT = path.join(ROOT, 'src/fieldInputs.generated.ts');

// Option types that are not plain primitives or enums.
const NAMED_TYPES = { timeRange: 'TimeRange', granularity: 'Granularity', color: 'string' };

const tsTypeFor = (input) => {
  const base = input.options?.length
    ? input.options.map((o) => JSON.stringify(o)).join(' | ')
    : (NAMED_TYPES[input.type] ?? input.type);
  if (!input.array) return base;
  return input.options?.length > 1 ? `(${base})[]` : `${base}[]`;
};

// One type covering every option any chart accepts on a field; which chart
// reads which option is in the JSON, rendered on the docs site.
const fieldInputsType = (data) => {
  const byName = new Map();
  for (const [chart, { fields }] of Object.entries(data)) {
    for (const field of Object.values(fields)) {
      for (const input of field.inputs) {
        const type = tsTypeFor(input);
        const seen = byName.get(input.name);
        if (!seen) byName.set(input.name, { input, type, chart });
        else if (seen.type !== type) {
          throw new Error(
            `Field option ${input.name} is ${seen.type} in ${seen.chart} but ${type} in ${chart}`,
          );
        } else if (!seen.input.description && input.description) seen.input = input;
      }
    }
  }
  const members = [...byName.values()].map(({ input, type }) => {
    const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
    const notes = [sentence(input.label)];
    if (input.description) notes.push(sentence(input.description));
    if (input.supportedTypes) notes.push(`Applies to ${input.supportedTypes.join(' and ')} fields.`);
    const doc = notes.join(' ').replace(/\*\//g, '* /');
    return `  /** ${doc} */\n  ${input.name}?: ${type};`;
  });
  return `// Generated by scripts/extract-field-inputs.mjs from remarkable-pro's chart
// definitions. Do not edit; run \`npm run sync\`.
import type { Granularity, TimeRange } from './runtime/core';

/** Per-field options read from a dimension's or measure's \`inputs\`. */
export type GeneratedFieldInputs = {
${members.join('\n')}
};
`;
};

export const writeFieldInputs = (data, outFile = FIELD_INPUTS_OUT, typesOutFile = FIELD_INPUTS_TYPES_OUT) => {
  fs.writeFileSync(outFile, `${JSON.stringify(data, null, 2)}\n`);
  fs.writeFileSync(typesOutFile, fieldInputsType(data));
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const srcRoot = path.resolve(process.argv[2] ?? path.join(ROOT, '../remarkable-pro/src'));
  const data = await extractFieldInputs(srcRoot);
  writeFieldInputs(data);
  console.log(`Extracted field inputs for ${Object.keys(data).length} charts.`);
}
