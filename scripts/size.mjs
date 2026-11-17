// How much JavaScript the library adds to an app, and how much each page of
// the docs site loads. Sizes are minified and gzipped (level 9).
//   npm run size               the library: a minimal app, and everything it exports
//   npm run size -- --site     the docs site: what each page loads (reads dist-site/,
//                              so run npm run site:build first) and its largest modules
//   npm run size -- --json     the library figures as JSON
// The library is built the way an app would build it: Vite in production mode,
// with react and react-dom left out (the app has them already). "On load" is
// the entry and everything it imports statically; "on demand" is what a
// dynamic import() fetches later (the export libraries).
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { transform } from 'esbuild';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Never the dev server's cache (node_modules/.vite): see scripts/site-build.mjs.
const cacheDir = join(root, 'node_modules/.vite-size');
const args = new Set(process.argv.slice(2));
const gzip = (code) => gzipSync(code, { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const pad = (text, width) => String(text).padStart(width);

// A module's package (npm:chart.js), or its path in this repository.
const owner = (id) => {
  const clean = id.replace(/\0/g, '').split('?')[0];
  const at = clean.lastIndexOf('node_modules/');
  if (at < 0) return relative(root, clean);
  const parts = clean.slice(at + 'node_modules/'.length).split('/');
  return `npm:${parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]}`;
};

// The chunks of a build, with which of them the entry needs before it can run.
const chunksOf = (result) => {
  const chunks = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output).filter((o) => o.type === 'chunk');
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const closure = (chunk, seen = new Set()) => {
    if (!chunk || seen.has(chunk)) return seen;
    seen.add(chunk);
    for (const imported of chunk.imports) closure(byName.get(imported), seen);
    return seen;
  };
  return { chunks, byName, closure };
};

// Each owner's share of some chunks: its modules minified one by one, then
// gzipped together. Close to, not exactly, its share of the real chunk (the
// bundler minifies and compresses across modules).
const breakdown = async (chunks, group = owner) => {
  const groups = new Map();
  await Promise.all(
    chunks.flatMap((chunk) =>
      Object.entries(chunk.modules).map(async ([id, module]) => {
        if (!module.code) return;
        const { code } = await transform(module.code, { minify: true, loader: 'js' });
        const key = group(id);
        groups.set(key, [...(groups.get(key) ?? []), code]);
      }),
    ),
  );
  return [...groups]
    .map(([name, codes]) => ({ name, min: codes.reduce((sum, code) => sum + code.length, 0), gzip: gzip(codes.join('\n')) }))
    .sort((a, b) => b.gzip - a.gzip);
};

const printBreakdown = (rows, count) => {
  for (const row of rows.slice(0, count)) console.log(`    ${pad(kb(row.gzip), 9)} gzip ${pad(kb(row.min), 10)} min  ${row.name}`);
};

// ---- The library ----------------------------------------------------------

const index = join(root, 'src/index.ts');
const apps = {
  minimal: {
    label: 'A minimal app: ChartsProvider, BarChart, dimension, measure, results',
    code: `
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart, ChartsProvider, dimension, measure, results } from ${JSON.stringify(index)};

const plan = dimension({ name: 'plan', title: 'Plan' });
const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { currency: 'USD', decimalPlaces: 0 } });
const rows = [{ plan: 'Starter', revenue: 48200 }, { plan: 'Team', revenue: 61300 }];

createRoot(document.getElementById('root')).render(
  createElement(ChartsProvider, null, createElement(BarChart, { title: 'Revenue by plan', dimension: plan, measures: [revenue], results: results(rows) })),
);
`,
  },
  everything: {
    label: 'Everything the package exports',
    code: `
import * as everything from ${JSON.stringify(index)};

// The namespace escapes, so nothing is dropped as unused.
globalThis.chartsUi = everything;
`,
  },
};

const measureApp = async (name) => {
  const dir = mkdtempSync(join(tmpdir(), 'rkit-size-'));
  try {
    const entry = join(dir, `${name}.ts`);
    writeFileSync(entry, apps[name].code);
    const result = await build({
      configFile: false,
      root,
      cacheDir,
      mode: 'production',
      logLevel: 'error',
      resolve: { dedupe: ['react', 'react-dom'] },
      build: {
        write: false,
        cssCodeSplit: false,
        reportCompressedSize: false,
        rollupOptions: { input: entry, external: [/^react(-dom)?(\/.*)?$/], onwarn: () => undefined },
      },
    });
    const { chunks, closure } = chunksOf(result);
    const onLoad = closure(chunks.find((chunk) => chunk.isEntry));
    const later = chunks.filter((chunk) => !onLoad.has(chunk));
    const css = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output).filter((o) => o.type === 'asset' && o.fileName.endsWith('.css'));
    const total = (list) => ({ min: list.reduce((sum, c) => sum + c.code.length, 0), gzip: list.reduce((sum, c) => sum + gzip(c.code), 0) });
    return {
      label: apps[name].label,
      onLoad: total([...onLoad]),
      onDemand: { ...total(later), chunks: later.map((chunk) => ({ name: chunk.name, min: chunk.code.length, gzip: gzip(chunk.code) })) },
      css: { min: css.reduce((sum, a) => sum + a.source.length, 0), gzip: css.reduce((sum, a) => sum + gzip(a.source), 0) },
      largest: (await breakdown([...onLoad])).slice(0, 12),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const library = async () => {
  const report = { minimal: await measureApp('minimal'), everything: await measureApp('everything') };
  if (args.has('--json')) return console.log(JSON.stringify(report, null, 2));
  console.log('Library, built with Vite for production, react and react-dom external\n');
  for (const app of Object.values(report)) {
    console.log(app.label);
    console.log(`  JavaScript on load    ${pad(kb(app.onLoad.gzip), 9)} gzip ${pad(kb(app.onLoad.min), 10)} min`);
    console.log(`  JavaScript on demand  ${pad(kb(app.onDemand.gzip), 9)} gzip ${pad(kb(app.onDemand.min), 10)} min  (${app.onDemand.chunks.map((c) => `${c.name} ${kb(c.gzip)}`).join(', ') || 'none'})`);
    console.log(`  CSS                   ${pad(kb(app.css.gzip), 9)} gzip ${pad(kb(app.css.min), 10)} min`);
    console.log('  Largest on load (each minified alone, so the parts add up to a little more than the whole):');
    printBreakdown(app.largest, 12);
    console.log('');
  }
};

// ---- The docs site --------------------------------------------------------

const sitePages = [
  '/',
  '/docs/quick-start',
  '/docs/why',
  '/docs/troubleshooting',
  '/docs/theming',
  '/docs/components',
  '/docs/components/bar-chart',
  '/docs/components/bar-chart/playground',
  '/examples',
  '/examples/ai-chat',
];

const site = async () => {
  const out = join(root, 'dist-site');
  if (!existsSync(join(out, 'index.html'))) throw new Error('dist-site/ is missing: run npm run site:build first');
  const sizes = new Map();
  const size = (file) => {
    if (!sizes.has(file)) sizes.set(file, { raw: readFileSync(join(out, file)).length, gzip: gzip(readFileSync(join(out, file))) });
    return sizes.get(file);
  };
  console.log('Docs site (dist-site/): the scripts each page loads, from its HTML (module script and modulepreload links)\n');
  for (const path of sitePages) {
    const html = readFileSync(join(out, path === '/' ? 'index.html' : `${path.slice(1)}/index.html`), 'utf-8');
    const files = [...html.matchAll(/<(?:script type="module"|link rel="modulepreload")[^>]*(?:src|href)="\/([^"]+\.js)"/g)].map((m) => m[1]);
    const total = files.reduce((sum, file) => ({ raw: sum.raw + size(file).raw, gzip: sum.gzip + size(file).gzip }), { raw: 0, gzip: 0 });
    console.log(`${pad(kb(total.gzip), 9)} gzip ${pad(kb(total.raw), 10)} min  ${pad(files.length, 2)} scripts  ${path}`);
  }
  console.log('\nBy chunk:');
  for (const [file, s] of [...sizes].sort((a, b) => b[1].gzip - a[1].gzip)) console.log(`${pad(kb(s.gzip), 9)} gzip ${pad(kb(s.raw), 10)} min  ${file}`);

  // The same build again in memory, for what is inside the chunks.
  const { chunks, closure } = chunksOf(await build({ configFile: join(root, 'vite.config.ts'), logLevel: 'error', cacheDir, build: { write: false, reportCompressedSize: false } }));
  const entry = closure(chunks.find((chunk) => chunk.isEntry));
  const lazy = chunks.filter((chunk) => !entry.has(chunk));
  console.log('\nLargest modules in what every page loads (the entry and its imports):');
  printBreakdown(await breakdown([...entry]), 20);
  console.log('\nLargest modules loaded later (page chunks and on-demand libraries):');
  printBreakdown(await breakdown(lazy), 8);
};

await (args.has('--site') ? site() : library());
