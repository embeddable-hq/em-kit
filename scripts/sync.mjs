#!/usr/bin/env node
// Pulls remarkable-pro source at a git ref, strips the Embeddable layer,
// and rewrites Embeddable imports onto this package's own runtime.
//
//   REMARKABLE_PRO_DIR  path to a remarkable-pro checkout (default ../remarkable-pro)
//   REMARKABLE_PRO_REF  git ref to sync from (default main; uncommitted work is never synced)

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.resolve(ROOT, process.env.REMARKABLE_PRO_DIR ?? '../remarkable-pro');
const REF = process.env.REMARKABLE_PRO_REF ?? 'main';
const OUT_DIR = path.join(ROOT, 'src/generated');
const RUNTIME_DIR = path.join(ROOT, 'src/runtime');

const EXCLUDE = [
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
];

// *.type.emb.ts files carry runtime option constants that chart code imports;
// keep them, minus the ".emb" suffix.
const KEEP_OVERRIDE = [/\.type\.emb\.ts$/];

const IMPORT_REWRITES = {
  '@embeddable.com/core': path.join(RUNTIME_DIR, 'core'),
  '@embeddable.com/react': path.join(RUNTIME_DIR, 'react'),
};

const ALLOWED_EMBEDDABLE_IMPORTS = new Set(['@embeddable.com/remarkable-ui', '@embeddable.com/remarkable-ui/styles']);

const isExcluded = (rel) =>
  !KEEP_OVERRIDE.some((re) => re.test(rel)) && EXCLUDE.some((re) => re.test(rel));

const renameOutput = (rel) => rel.replace(/\.type\.emb\.ts$/, '.type.ts');

const toImportPath = (fromFile, target) => {
  let rel = path.relative(path.dirname(fromFile), target).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
};

const rewriteSource = (code, outFile) => {
  let result = code;
  for (const [specifier, target] of Object.entries(IMPORT_REWRITES)) {
    const importPath = toImportPath(outFile, target);
    result = result.replaceAll(`'${specifier}'`, `'${importPath}'`).replaceAll(`"${specifier}"`, `"${importPath}"`);
  }
  return result.replace(/(['"])([^'"]+\.type)\.emb\1/g, '$1$2$1');
};

const walk = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });

const main = () => {
  const sha = execSync(`git -C "${SOURCE_DIR}" rev-parse ${REF}`).toString().trim();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'charts-ui-sync-'));
  execSync(`git -C "${SOURCE_DIR}" archive ${sha} src | tar -x -C "${tmp}"`);
  const srcRoot = path.join(tmp, 'src');

  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  const leaks = [];
  let kept = 0;
  let skipped = 0;

  for (const rel of walk(srcRoot)) {
    if (isExcluded(rel)) {
      skipped++;
      continue;
    }
    const outFile = path.join(OUT_DIR, renameOutput(rel));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });

    if (/\.(ts|tsx)$/.test(rel)) {
      const code = rewriteSource(fs.readFileSync(path.join(srcRoot, rel), 'utf8'), outFile);
      for (const match of code.matchAll(/['"](@embeddable\.com\/[^'"]+)['"]/g)) {
        if (!ALLOWED_EMBEDDABLE_IMPORTS.has(match[1])) leaks.push(`${rel}: ${match[1]}`);
      }
      fs.writeFileSync(outFile, code);
    } else {
      fs.copyFileSync(path.join(srcRoot, rel), outFile);
    }
    kept++;
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  if (leaks.length) {
    console.error(`Unmapped Embeddable imports:\n  ${leaks.join('\n  ')}`);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(ROOT, 'sync-state.json'),
    `${JSON.stringify({ source: 'remarkable-pro', ref: REF, sha, syncedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  console.log(`Synced remarkable-pro@${sha.slice(0, 8)}: ${kept} files kept, ${skipped} excluded.`);
};

main();
