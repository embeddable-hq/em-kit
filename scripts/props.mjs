#!/usr/bin/env node
// Extracts every public component's props from the TypeScript types and writes
// site/generated/props.ts for the chart pages' props reference. Then derives
// src/ai/spec.schema.generated.ts, the JSON Schema of the chart spec in
// src/spec.ts. Runs after sync, so neither can drift from the real types.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createGenerator } from 'ts-json-schema-generator';
import { components } from './components.manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'src/index.ts');
const OUT = path.join(ROOT, 'site/generated/props.ts');
const SPEC = path.join(ROOT, 'src/spec.ts');
const SCHEMA_OUT = path.join(ROOT, 'src/ai/spec.schema.generated.ts');
const FIELD_INPUTS = path.join(ROOT, 'src/fieldInputs.generated.json');
const fieldInputs = JSON.parse(fs.readFileSync(FIELD_INPUTS, 'utf8'));

const configFile = ts.readConfigFile(path.join(ROOT, 'tsconfig.json'), ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, ROOT);
const program = ts.createProgram([INDEX], config.options);
const checker = program.getTypeChecker();

const sourceFile = program.getSourceFile(INDEX);
const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
const exports = checker.getExportsOfModule(moduleSymbol);
const exportNames = new Set(exports.map((e) => e.name));

const result = {};
const fieldOptions = {};
const missingFieldOptions = [];

for (const exported of exports) {
  if (!exported.name.endsWith('Props')) continue;
  const componentName = exported.name.slice(0, -'Props'.length);
  if (!exportNames.has(componentName)) continue;

  let symbol = exported;
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const type = checker.getDeclaredTypeOfSymbol(symbol);

  // Field options are keyed by the upstream component's folder name, which the
  // manifest records for every published chart.
  const manifestEntry = components.find((c) => c.name === componentName);
  const isChart = manifestEntry?.path.startsWith('components/charts/');
  if (isChart) {
    const upstream = manifestEntry.path.split('/').pop();
    if (fieldInputs[upstream]) fieldOptions[componentName] = fieldInputs[upstream].fields;
    else missingFieldOptions.push(`${componentName} (${upstream})`);
  }

  const props = checker.getPropertiesOfType(type).map((prop) => {
    const declaration = prop.valueDeclaration ?? prop.declarations?.[0] ?? sourceFile;
    const propType = checker.getTypeOfSymbolAtLocation(prop, declaration);
    const required = !(prop.flags & ts.SymbolFlags.Optional);
    const nonNullable = checker.getNonNullableType(propType);
    let typeText = checker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation);
    if (!required) typeText = typeText.replace(/^undefined \| /, '').replace(/ \| undefined$/, '');

    // A handler behind a named alias prints as the alias; show the signature,
    // and the shape of its payload parameter where it has one.
    let payload;
    const signatures = nonNullable.getCallSignatures();
    if (signatures.length === 1) {
      const signature = signatures[0];
      if (!typeText.includes('=>')) {
        typeText = checker
          .signatureToString(signature, undefined, ts.TypeFormatFlags.NoTruncation)
          .replace(/\):\s*([^)]*)$/, ') => $1');
      }
      const param = signature.getParameters()[0];
      if (param) {
        const paramType = checker.getTypeOfSymbolAtLocation(param, declaration);
        if (paramType.getProperties().length && !checker.typeToString(paramType).startsWith('{')) {
          payload = checker.typeToString(
            paramType,
            undefined,
            ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias,
          );
          if (payload.startsWith('{')) payload = `${checker.typeToString(paramType)} = ${payload}`;
          else payload = undefined;
        }
      }
    }

    // Controlled-state aliases are worth showing structurally too.
    if (!payload && /^[A-Za-z]+State$/.test(typeText)) {
      const expanded = checker.typeToString(
        nonNullable,
        undefined,
        ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias,
      );
      if (expanded.startsWith('{')) payload = `${typeText} = ${expanded}`;
    }

    // Internal alias names keep the upstream Pro suffix; the display text
    // should match the public naming.
    const clean = (text) =>
      text
        ?.replace(/\bTableChartPaginatedPro/g, 'TablePaginated')
        .replace(/\bTableScrollablePro/g, 'TableScrollable')
        .replace(/([A-Za-z])Pro(?=[A-Z])/g, '$1');
    const doc = ts.displayPartsToString(prop.getDocumentationComment(checker)).trim();
    return {
      name: prop.name,
      type: clean(typeText),
      required,
      ...(payload ? { payload: clean(payload) } : {}),
      ...(doc ? { doc } : {}),
    };
  });

  if (props.length) result[componentName] = props;
}

const names = Object.keys(result);
if (names.length < 20) {
  console.error(`props: only found ${names.length} components (${names.join(', ')}); expected the full public API.`);
  process.exit(1);
}

if (missingFieldOptions.length) {
  console.error(`props: no field options in src/fieldInputs.generated.json for ${missingFieldOptions.join(', ')}.`);
  process.exit(1);
}

const header = `// Generated by scripts/props.mjs from the public component types. Do not edit.
export type PropDoc = { name: string; type: string; required: boolean; payload?: string; doc?: string };

export type FieldOptionDoc = {
  name: string;
  label: string;
  type: string;
  options?: string[];
  description?: string;
  array?: boolean;
  supportedTypes?: string[];
  defaultValue?: unknown;
};
export type FieldDoc = { kind: string; label: string; array?: boolean; required?: boolean; inputs: FieldOptionDoc[] };

export const componentFieldOptions: Record<string, Record<string, FieldDoc>> = ${JSON.stringify(fieldOptions, null, 2)};

export const componentProps: Record<string, PropDoc[]> = `;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${header}${JSON.stringify(result, null, 2)};\n`);
console.log(`Extracted props for ${names.length} components into site/generated/props.ts.`);

// ---------------------------------------------------------------------------
// Chart spec JSON Schema (src/spec.ts -> src/ai/spec.schema.generated.ts)
// ---------------------------------------------------------------------------
//
// Two exports, because tool-calling APIs (Anthropic `input_schema`, OpenAI
// `parameters`) reject a top-level anyOf/oneOf and want a root object:
//   chartSpecSchema     the exact discriminated union (anyOf, one branch per
//                       spec type), for validating specs.
//   chartSpecToolSchema the same fields flattened into one root object, with
//                       the per-kind field lists in its description. The
//                       validator stays the union; the tool schema is guidance.

// The conventions from spec.ts's header comment: they cut across every field,
// so a producer that only sees the schema needs them on the root.
const ROOT_DESCRIPTION =
  'A chart to render. `chart` selects the kind and which other fields apply. ' +
  'A field (`dimension`, `measure`, `measures`, `xAxis`, ...) is a bare row-key string or a { name, ... } object. ' +
  'Options use vertical orientation for every kind: `xAxis`/`xAxisLabel` is the category axis and `yAxisRange*` the value range, ' +
  'even for horizontal variants. Set `granularity` on the chart, never on a field, when the category axis is a time field. ' +
  '`rows` is long format with zone-less ISO time strings.';

const canon = (value) =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
const withoutDescription = ({ description: _description, ...rest }) => rest;
const hasProps = (s) => s.type === 'object' && s.properties;
const unique = (items) => [...new Set(items)];

// Combines two schemas for the same property across chart kinds: objects merge
// key by key, equal schemas collapse, anything else becomes an anyOf.
function mergeSchemas(a, b) {
  if (hasProps(a) && hasProps(b)) {
    const properties = { ...a.properties };
    for (const [key, schema] of Object.entries(b.properties)) {
      properties[key] = key in properties ? mergeSchemas(properties[key], schema) : schema;
    }
    const required = (a.required ?? []).filter((key) => (b.required ?? []).includes(key));
    const { required: _required, ...rest } = a;
    const description = a.description ?? b.description;
    return { ...rest, properties, ...(required.length ? { required } : {}), ...(description ? { description } : {}) };
  }
  const description = a.description ?? b.description;
  if (canon(withoutDescription(a)) === canon(withoutDescription(b))) {
    return description ? { ...withoutDescription(a), description } : withoutDescription(a);
  }
  const members = (s) => s.anyOf ?? [withoutDescription(s)];
  const seen = new Map();
  for (const member of [...members(a), ...members(b)]) seen.set(canon(member), member);
  return { anyOf: [...seen.values()], ...(description ? { description } : {}) };
}

const refsIn = (node, found = new Set()) => {
  if (Array.isArray(node)) node.forEach((item) => refsIn(item, found));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref') found.add(value.replace('#/$defs/', ''));
      else refsIn(value, found);
    }
  }
  return found;
};

// Only the definitions a schema can actually reach, in a stable order.
function reachableDefs(root, defs) {
  const keep = new Set();
  const queue = [...refsIn(root)];
  while (queue.length) {
    const name = queue.pop();
    if (keep.has(name)) continue;
    keep.add(name);
    queue.push(...refsIn(defs[name]));
  }
  return Object.fromEntries([...keep].sort().map((name) => [name, defs[name]]));
}

function generateSpecSchema() {
  const raw = createGenerator({
    path: SPEC,
    tsconfig: path.join(ROOT, 'tsconfig.json'),
    type: 'ChartSpec',
    expose: 'export',
    topRef: true,
    additionalProperties: false,
    sortProps: false,
    jsDoc: 'extended',
    skipTypeCheck: true, // `npm run types:check` owns type errors
  }).createSchema('ChartSpec');

  // draft-07 spells it `definitions`; the output declares 2020-12 (`$defs`).
  const { ChartSpec: union, ...defs } = JSON.parse(
    JSON.stringify(raw.definitions).replaceAll('#/definitions/', '#/$defs/'),
  );
  const branchNames = union.anyOf.map((branch) => branch.$ref.replace('#/$defs/', ''));
  const variants = branchNames.map((name) => defs[name]);
  const kindsOf = (variant) => variant.properties.chart.enum ?? [variant.properties.chart.const];

  // Drift alarm: every kind in CHART_KINDS has a branch, and the reverse.
  const listed = /export const CHART_KINDS = \[([^\]]*)\]/.exec(fs.readFileSync(SPEC, 'utf8'))?.[1];
  const declared = [...(listed ?? '').matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
  const inSchema = variants.flatMap(kindsOf);
  if (!declared.length || canon([...declared].sort()) !== canon([...inSchema].sort())) {
    console.error(
      `spec schema: CHART_KINDS (${declared.join(', ')}) and the ChartSpec union (${inSchema.join(', ')}) disagree.`,
    );
    process.exit(1);
  }

  const chartSpecSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'ChartSpec',
    description: ROOT_DESCRIPTION,
    anyOf: branchNames.map((name) => ({ $ref: `#/$defs/${name}` })),
    $defs: Object.fromEntries(Object.entries(defs).sort(([a], [b]) => (a < b ? -1 : 1))),
  };

  // Flattened root object for tool definitions.
  const sharedKeys = Object.keys(variants[0].properties).filter(
    (key) => key !== 'chart' && variants.every((v) => key in v.properties),
  );
  const perKind = variants.map((variant) => {
    const own = Object.keys(variant.properties).filter((key) => key !== 'chart' && !sharedKeys.includes(key));
    const required = own.filter((key) => variant.required?.includes(key));
    const optional = own.filter((key) => !required.includes(key));
    return `${kindsOf(variant).join(', ')}: ${required.join(', ')}${optional.length ? ` (optional: ${optional.join(', ')})` : ''}`;
  });

  const entries = new Map();
  for (const variant of variants) {
    for (const [key, schema] of Object.entries(variant.properties)) {
      if (key !== 'chart') entries.set(key, [...(entries.get(key) ?? []), { kinds: kindsOf(variant), schema }]);
    }
  }
  const properties = {
    chart: {
      type: 'string',
      enum: unique(inSchema),
      description: 'Chart kind. Selects which of the other fields apply (see the root description).',
    },
  };
  const order = [...sharedKeys.filter((key) => key !== 'options'), ...entries.keys()];
  for (const key of unique(order)) {
    const group = entries.get(key);
    let merged = group.map((entry) => entry.schema).reduce(mergeSchemas);
    // Same field, different meaning per kind: label each description with its kinds.
    const docs = unique(group.map((entry) => entry.schema.description).filter(Boolean));
    if (docs.length > 1) {
      const text = docs.map((doc) => {
        const kinds = unique(group.filter((entry) => entry.schema.description === doc).flatMap((entry) => entry.kinds));
        return `${kinds.map((kind) => `\`${kind}\``).join(', ')}: ${doc}`;
      });
      merged = { ...merged, description: text.join(' ') };
    }
    properties[key] = merged;
  }

  const toolRoot = {
    type: 'object',
    description: `${ROOT_DESCRIPTION}\nFields by chart kind (every kind also accepts ${sharedKeys.join(', ')}):\n${perKind.join('\n')}`,
    properties,
    required: ['chart'],
    additionalProperties: false,
  };
  const chartSpecToolSchema = { ...toolRoot, $defs: reachableDefs(toolRoot, defs) };
  return { chartSpecSchema, chartSpecToolSchema };
}

const { chartSpecSchema, chartSpecToolSchema } = generateSpecSchema();

const schemaHeader = `// Generated by scripts/props.mjs — do not edit.
// Source of truth: src/spec.ts. Regenerate with \`npm run sync\`.

/** A root-object JSON Schema, the shape tool APIs accept (no top-level anyOf/oneOf). */
export type ToolInputSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  [key: string]: unknown;
};

/** The ChartSpec union as JSON Schema 2020-12, one \`anyOf\` branch per spec type. Validates a spec. */
export const chartSpecSchema = ${JSON.stringify(chartSpecSchema, null, 2)} as const;

/** The same fields flattened into one root object, for \`input_schema\` / \`parameters\`. Guides a producer; validate with chartSpecSchema. */
export const chartSpecToolSchema: ToolInputSchema = ${JSON.stringify(chartSpecToolSchema, null, 2)};
`;

fs.mkdirSync(path.dirname(SCHEMA_OUT), { recursive: true });
fs.writeFileSync(SCHEMA_OUT, schemaHeader);
console.log(
  `Generated the chart spec schema (${chartSpecSchema.anyOf.length} spec types, ${Math.round(schemaHeader.length / 1024)} KB) into src/ai/spec.schema.generated.ts.`,
);
