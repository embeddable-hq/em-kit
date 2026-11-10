#!/usr/bin/env node
// Pulls remarkable-pro and remarkable-ui source at a git ref, strips the
// Embeddable layer, and rewrites Embeddable imports onto this package's own
// runtime and the mirrored remarkable-ui tree. After a sync, no
// @embeddable.com import may remain anywhere.
//
//   REMARKABLE_PRO_DIR  path to a remarkable-pro checkout (default ../remarkable-pro)
//   REMARKABLE_PRO_REF  git ref to sync from (default origin/main, fetched first;
//                       uncommitted work is never synced)
//   REMARKABLE_UI_DIR   path to a remarkable-ui checkout (default ../remarkable-ui)
//   REMARKABLE_UI_REF   git ref to sync from (default origin/main, fetched first)
//   SYNC_NO_FETCH=1     use the refs as they are locally, without fetching

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkManifest, discoverUpstreamComponents } from './components.manifest.mjs';
import { extractFieldInputs, writeFieldInputs } from './extract-field-inputs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_DIR = path.join(ROOT, 'src/runtime');
const UI_OUT = path.join(ROOT, 'src/generated-ui');

const EXCLUDE_PRO = [
  // Embeddable component registration and builder metadata
  /\.emb\.ts$/,
  /(^|\/)definition\.ts$/,
  /^editors\//,
  /^index\.ts$/,
  /^components\/component\.(sub)?inputs\.constants\.ts$/,
  /^components\/preview\.data\.constants\.ts$/,
  /\.loadData\.utils\.ts$/,
  // Editors bound to Embeddable's dimension/measure model
  /^components\/editors\/filters\//,
  /^components\/editors\/(DimensionOrMeasureMultiSelectFieldPro|DimensionSingleSelectFieldPro|MeasureMultiSelectFieldPro|MeasureSingleSelectFieldPro)\//,
  /^components\/editors\/shared\/DimensionAndMeasureSingleSelectField\//,
  // Tests run against Embeddable mocks upstream
  /\.test\.tsx?$/,
  /(^|\/)test-utils\//,
  /\.stories\.tsx?$/,
  /^vitest\.d\.ts$/,
];

const EXCLUDE_UI = [
  /\.test\.tsx?$/,
  /\.stories\.tsx?$/,
  /(^|\/)test-utils\//,
  /^storybook\.constants\.tsx$/,
  /^vitest\.d\.ts$/,
];

// *.type.emb.ts files carry runtime option constants that chart code imports;
// keep them, minus the ".emb" suffix.
const KEEP_OVERRIDE_PRO = [/\.type\.emb\.ts$/];

const SOURCES = [
  {
    name: 'remarkable-ui',
    dir: path.resolve(ROOT, process.env.REMARKABLE_UI_DIR ?? '../remarkable-ui'),
    ref: process.env.REMARKABLE_UI_REF ?? 'origin/main',
    out: UI_OUT,
    exclude: EXCLUDE_UI,
    keep: [],
    importRewrites: {},
    contentRewrites: [
      {
        file: 'components/charts/kpis/KpiChart.module.css',
        from: "  font-weight: var(--em-kpichart-number-font-weight, 700);\n}",
        to: "  font-weight: var(--em-kpichart-number-font-weight, 700);\n  /* Follow AutoTextSize, not a host page's h2 rule. */\n  font-size: inherit;\n}",
        why: 'a global h2 font-size in the host page pins the KPI number and defeats auto-sizing; remove once fixed in remarkable-ui',
      },
    ],
  },
  {
    name: 'remarkable-pro',
    dir: path.resolve(ROOT, process.env.REMARKABLE_PRO_DIR ?? '../remarkable-pro'),
    ref: process.env.REMARKABLE_PRO_REF ?? 'origin/main',
    out: path.join(ROOT, 'src/generated'),
    exclude: EXCLUDE_PRO,
    keep: KEEP_OVERRIDE_PRO,
    importRewrites: {
      // Longer specifiers first: replacement is exact (quoted) per specifier.
      '@embeddable.com/remarkable-ui/styles': path.join(UI_OUT, 'styles/index'),
      '@embeddable.com/remarkable-ui': path.join(UI_OUT, 'index'),
      '@embeddable.com/core': path.join(RUNTIME_DIR, 'core'),
      '@embeddable.com/react': path.join(RUNTIME_DIR, 'react'),
    },
    // Targeted source edits that must keep applying; the sync fails when one
    // stops matching so upstream drift surfaces here instead of at runtime.
    contentRewrites: [
      {
        file: 'theme/styles/styles.utils.ts',
        from: "const STORAGE_KEY = 'embeddable';",
        to: "const STORAGE_KEY = 'charts-ui';",
        why: 'colour assignments persist under a neutral key',
      },
      {
        file: 'components/charts/shared/ChartCard/ChartCard.tsx',
        from: '    onCustomDownload,\n    menuOptions,\n  } = props;',
        to: "    onCustomDownload,\n    // Embeddable's builder supplies this default; standalone there is no builder.\n    menuOptions = ['csv', 'xlsx', 'png', 'maximize'],\n  } = props;",
        why: "the menu is opt-in upstream and the default lives in the builder input (component.inputs.constants.ts); keep in step with it",
      },
      {
        file: 'components/charts/scatter/ScatterChartPro/ScatterChartPro.utils.ts',
        from: "          value: {\n            display: 'auto',\n",
        to: '          value: {\n',
        why: "upstream forces value labels on, overriding showValueLabels; remove once fixed in remarkable-pro",
      },
      {
        file: 'components/charts/scatter/ScatterChartPro/ScatterChartPro.utils.ts',
        from: "          caption: {\n            display: 'auto',\n",
        to: '          caption: {\n',
        why: "upstream forces point labels on, overriding showPointLabels; remove once fixed in remarkable-pro",
      },
    ],
    // definition.ts files are excluded above, but the per-field options they
    // declare (prefix, decimalPlaces, columnAggregation, …) are public API here.
    afterExtract: async (srcRoot, errors) => {
      // Every upstream component must be exported or skipped in the manifest.
      errors.push(...checkManifest(discoverUpstreamComponents(walk(srcRoot))).map((e) => `remarkable-pro: ${e}`));
      writeFieldInputs(await extractFieldInputs(srcRoot));
    },
  },
];

const isExcluded = (source, rel) =>
  !source.keep.some((re) => re.test(rel)) && source.exclude.some((re) => re.test(rel));

const renameOutput = (rel) => rel.replace(/\.type\.emb\.ts$/, '.type.ts');

const toImportPath = (fromFile, target) => {
  let rel = path.relative(path.dirname(fromFile), target).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
};

const applyContentRewrites = (source, code, relFile, errors) => {
  let result = code;
  for (const rewrite of source.contentRewrites) {
    if (rewrite.file !== relFile) continue;
    if (!result.includes(rewrite.from)) {
      errors.push(`${source.name}/${relFile}: content rewrite no longer matches (${rewrite.why}): ${rewrite.from}`);
      continue;
    }
    result = result.replaceAll(rewrite.from, rewrite.to);
  }
  return result;
};

const rewriteSource = (source, code, relFile, outFile, errors) => {
  let result = code;
  for (const [specifier, target] of Object.entries(source.importRewrites)) {
    const importPath = toImportPath(outFile, target);
    result = result.replaceAll(`'${specifier}'`, `'${importPath}'`).replaceAll(`"${specifier}"`, `"${importPath}"`);
  }
  result = applyContentRewrites(source, result, relFile, errors);
  return result.replace(/(['"])([^'"]+\.type)\.emb\1/g, '$1$2$1');
};

const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });

const syncSource = async (source, errors) => {
  if (!process.env.SYNC_NO_FETCH && source.ref.startsWith('origin/')) {
    execSync(`git -C "${source.dir}" fetch --quiet origin`);
  }
  const sha = execSync(`git -C "${source.dir}" rev-parse ${source.ref}`).toString().trim();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'charts-ui-sync-'));
  execSync(`git -C "${source.dir}" archive ${sha} src | tar -x -C "${tmp}"`);
  const srcRoot = path.join(tmp, 'src');

  fs.rmSync(source.out, { recursive: true, force: true });

  let kept = 0;
  let skipped = 0;

  for (const rel of walk(srcRoot)) {
    if (isExcluded(source, rel)) {
      skipped++;
      continue;
    }
    const outFile = path.join(source.out, renameOutput(rel));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    if (/\.(ts|tsx)$/.test(rel)) {
      const code = rewriteSource(source, fs.readFileSync(path.join(srcRoot, rel), 'utf8'), rel, outFile, errors);
      for (const match of code.matchAll(/['"](@embeddable\.com\/[^'"]+)['"]/g)) {
        errors.push(`${source.name}/${rel}: unmapped Embeddable import ${match[1]}`);
      }
      fs.writeFileSync(outFile, code);
    } else if (source.contentRewrites.some((rewrite) => rewrite.file === rel)) {
      const text = fs.readFileSync(path.join(srcRoot, rel), 'utf8');
      fs.writeFileSync(outFile, applyContentRewrites(source, text, rel, errors));
    } else {
      fs.copyFileSync(path.join(srcRoot, rel), outFile);
    }
    kept++;
  }

  for (const rewrite of source.contentRewrites) {
    if (!fs.existsSync(path.join(srcRoot, rewrite.file))) {
      errors.push(`${source.name}/${rewrite.file}: content rewrite target no longer exists (${rewrite.why})`);
    }
  }

  await source.afterExtract?.(srcRoot, errors);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`Synced ${source.name}@${sha.slice(0, 8)}: ${kept} files kept, ${skipped} excluded.`);
  return { ref: source.ref, sha, syncedAt: new Date().toISOString() };
};

const main = async () => {
  const errors = [];
  const state = {};
  for (const source of SOURCES) state[source.name] = await syncSource(source, errors);

  if (errors.length) {
    console.error(`Sync failed:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }

  fs.writeFileSync(path.join(ROOT, 'sync-state.json'), `${JSON.stringify({ sources: state }, null, 2)}\n`);
};

await main();
