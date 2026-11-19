// Builds the static site into dist-site/: the Vite client build, then every
// page prerendered to HTML with its head tags, the agent files (llms.txt, .md
// twins, sitemap, robots), a playground page per component and preset,
// redirect pages for old URLs, 404.html and _redirects.
//   npm run site:build            build
//   npm run site:build -- --check build, then assert every page's HTML
// SITE_URL overrides the absolute URLs (default: BRAND.url).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import { build, createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-site');
const started = Date.now();
const check = process.argv.includes('--check');

// Vite's cache directory, for this script only. The dev server's cache
// (node_modules/.vite) holds React optimised in development mode; a server
// created here runs after build() has set NODE_ENV=production, and sharing that
// cache would replace it with production React, so the running dev server
// would then fail on every page ("jsxDEV is not a function").
const cacheDir = join(root, 'node_modules/.vite-site-build');

await build({ configFile: join(root, 'vite.config.ts'), logLevel: 'warn', cacheDir, build: { outDir: out, emptyOutDir: true } });

// Vite's map of the client build: each source module that became a chunk, the
// file it is in and the chunks it imports. Read here, not deployed.
const manifest = JSON.parse(readFileSync(join(out, '.vite/manifest.json'), 'utf-8'));
rmSync(join(out, '.vite'), { recursive: true });

// The files a chunk needs before it can run: itself and everything it imports.
const chunkFiles = (key, files = new Set()) => {
  const chunk = manifest[key];
  if (!chunk || files.has(chunk.file)) return files;
  files.add(chunk.file);
  for (const imported of chunk.imports ?? []) chunkFiles(imported, files);
  return files;
};

// Each page is its own chunk, and so are the chart library and a guide's live
// charts (site/App.tsx). The HTML template already loads the entry and what
// the entry imports; these tags add the chunks the page's first render needs
// (pageSources) and whatever they import, so the browser fetches them
// alongside the entry instead of finding out about them once the entry has run.
const pagePreloads = (sources, template) =>
  [...sources.reduce((files, source) => chunkFiles(source, files), new Set())]
    .filter((file) => !template.includes(`/${file}"`))
    .map((file) => `<link rel="modulepreload" crossorigin href="/${file}">`);

// Libraries that load when a visitor uses the feature that needs them (a
// chart's export menu), so no page may load them up front. Rollup names their
// chunks after the package (assets/xlsx-….js, assets/dom-to-image-more.min-….js).
const onDemand = Object.keys(manifest).filter((key) => /^assets\/(xlsx|dom-to-image-more)[.-]/.test(manifest[key].file));

// The JavaScript a page's HTML loads: its module script and every modulepreload.
const gzipSizes = new Map();
const gzipSize = (file) => {
  if (!gzipSizes.has(file)) gzipSizes.set(file, gzipSync(readFileSync(join(out, file)), { level: 9 }).length);
  return gzipSizes.get(file);
};
const pageScripts = (html) =>
  [...html.matchAll(/<(?:script type="module"|link rel="modulepreload")[^>]*(?:src|href)="\/([^"]+\.js)"/g)].map((m) => m[1]);
const pageScriptBytes = (html) => pageScripts(html).reduce((sum, file) => sum + gzipSize(file), 0);
// No page may load more gzipped JavaScript than this, and a page that draws no
// chart (pageDrawsCharts in site/App.tsx) loads no chart code, so far less.
// The site was one 560 KB script on every page; raise a number only with a reason.
const SCRIPT_BUDGET_KB = { text: 150, charts: 450 };

// Only for ssrLoadModule, which runs node_modules as they are: the client's
// dependency optimiser has nothing to do here, so it does not run.
const server = await createServer({
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'error',
  appType: 'custom',
  cacheDir,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
});

const write = (file, body) => {
  const target = join(out, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
};
const htmlFile = (path) => (path === '/' ? 'index.html' : `${path.replace(/^\//, '')}/index.html`);
const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');


// A module that holds printed type shapes to the package's exports: one
// error per shape that is not its export exactly (an intersection is compared
// as the one object it is). tests/shapes.test.ts runs the same check.
const exactShapes = (shapes, pkg) => {
  const referenced = new Set(shapes.flatMap(([, definition]) => [...definition.replace(/"[^"]*"/g, '').matchAll(/\b[A-Z]\w*\b/g)].map((m) => m[0])));
  const imports = [...referenced].filter((name) => !['Date', 'Record', 'Partial', 'Array'].includes(name));
  return [
    `import type * as Package from '${pkg}';`,
    imports.length ? `import type { ${imports.join(', ')} } from '${pkg}';` : '',
    'type Flat<T> = { [K in keyof T]: T[K] };',
    'type Exact<A, B> = (<T>() => T extends Flat<A> ? 1 : 2) extends (<T>() => T extends Flat<B> ? 1 : 2) ? true : false;',
    ...shapes.flatMap(([name, definition], i) => [
      `namespace Printed${i} { export type ${name} = ${definition}; }`,
      `export const shape${i}: Exact<Printed${i}.${name}, Package.${name}> = true; // ${name}`,
    ]),
  ].join('\n');
};

// The Markdown the site publishes, read back from dist-site: every twin is there,
// starts with a heading and is listed in llms.txt, and every TypeScript sample in
// it compiles against the package. Returns a list of problems.
const checkAgentFiles = (pages, markdownPath, origin, BRAND) => {
  const problems = [];
  const read = (file) => readFileSync(join(out, file), 'utf-8');
  const llms = read('llms.txt');
  const samples = new Map();
  for (const p of pages) {
    const file = markdownPath(p.path).replace(/^\//, '');
    let md;
    try {
      md = read(file);
    } catch {
      problems.push(`${p.path}: no Markdown twin at ${file}`);
      continue;
    }
    if (!md.startsWith('# ')) problems.push(`${file}: does not start with "# "`);
    // llms.txt is the index, so it does not list the landing page.
    if (p.path !== '/' && !llms.includes(`(${origin}${markdownPath(p.path)})`)) problems.push(`${file}: not listed in llms.txt`);
    let n = 0;
    for (const [, lang, info, code] of md.matchAll(/```(tsx|ts)([^\n]*)\n([\s\S]*?)```/g)) {
      n++;
      const title = info.match(/title="([^"]+)"/)?.[1] ?? `block${n}.${lang}`;
      // A block of bare type declarations is the page's copy of exported types
      // (payloads, table state, TimeRange): each must be its export, exactly.
      const shapes = /^(type \w+ = .*\n?)+$/.test(code) ? [...code.matchAll(/^type (\w+) = (.*)$/gm)].map((m) => [m[1], m[2]]) : undefined;
      samples.set(join(root, '.mdcheck', file.replace(/\.md$/, ''), shapes ? `${title}.shapes.ts` : title), {
        code: shapes ? exactShapes(shapes, BRAND.packageName) : code,
        label: `${file} :: ${shapes ? 'type shapes' : title}`,
      });
    }
  }

  const config = ts.getParsedCommandLineOfConfigFile(join(root, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(String(d.messageText)); } });
  const options = {
    ...config.options,
    strict: true,
    noEmit: true,
    baseUrl: root,
    paths: { [BRAND.packageName]: ['src/index.ts'], [`${BRAND.packageName}/ai`]: ['src/ai/index.ts'], [`${BRAND.packageName}/build`]: ['src/build/index.ts'] },
  };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, getSourceFile, directoryExists } = host;
  const dirs = [...samples.keys()].map((f) => dirname(f));
  host.directoryExists = (d) => dirs.some((v) => v === d || v.startsWith(`${d}/`)) || directoryExists(d);
  host.fileExists = (f) => samples.has(f) || fileExists(f);
  host.readFile = (f) => samples.get(f)?.code ?? readFile(f);
  host.getSourceFile = (f, ...rest) =>
    samples.has(f)
      ? ts.createSourceFile(f, samples.get(f).code, rest[0], true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      : getSourceFile(f, ...rest);
  const program = ts.createProgram([...samples.keys()], options, host);
  for (const [file, { label }] of samples) {
    const source = program.getSourceFile(file);
    for (const d of [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]) {
      const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
      // The one import the site cannot resolve: the chartFor.ts sample imports
      // @anthropic-ai/sdk, a server-side dependency of the reader's app that this
      // repository does not install. Every other diagnostic, in that file too, counts.
      if (d.code === 2307 && message.includes("'@anthropic-ai/sdk'")) continue;
      const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0;
      const shape = label.endsWith(':: type shapes') ? ` (${samples.get(file).code.split('\n')[line - 1]?.split('// ')[1]} is not its export)` : '';
      problems.push(`${label} line ${line}${shape}: TS${d.code} ${message.slice(0, 200)}`);
    }
  }
  return problems;
};

try {
  const { withDom, generateAgentFiles } = await server.ssrLoadModule('/agent-plugin.ts');
  const failures = await withDom(async () => {
    const { BRAND, TRACKING } = await server.ssrLoadModule('/config.ts');
    const { sitePages, legacyRedirects, markdownPath, markdownRedirectTarget } = await server.ssrLoadModule('/content/pages.ts');
    const { headFor, applyHead } = await server.ssrLoadModule('/head.ts');
    const { renderRoute } = await server.ssrLoadModule('/prerender.tsx');
    const { pageDrawsCharts, pageSources } = await server.ssrLoadModule('/App.tsx');

    const origin = (process.env.SITE_URL ?? BRAND.url).replace(/\/+$/, '');
    const template = readFileSync(join(out, 'index.html'), 'utf-8');
    // Samples and links in the page body name BRAND.url; a build for another origin names that one.
    // Each page's prerendered body, kept so the check below can confirm the
    // file holds it byte for byte.
    const bodies = new Map();
    const body = (path) => {
      const html = renderRoute(path).split(BRAND.url).join(origin);
      bodies.set(path, html);
      return html;
    };
    const preloads = (path) => pagePreloads(pageSources(path), template).map((tag) => `  ${tag}\n  `).join('');
    const page = (path, head) =>
      applyHead(template, head)
        .replace('</head>', (m) => `${preloads(path)}${m}`)
        // A function, not a string: page text can hold `$&` or `$'`, which a
        // replacement string would treat as patterns (e.g. `prefix: '$'`).
        .replace('<div id="root"></div>', () => `<div id="root">${body(path)}</div>`);

    const pages = sitePages();
    for (const p of pages) write(htmlFile(p.path), page(p.path, headFor(p.path, origin)));

    // A playground per component and per preset: real files, so a plain static
    // host answers 200. They are tools, not documents: no Markdown twin of their
    // own and not in the sitemap.
    const { chartEntries } = await server.ssrLoadModule('/catalog/registry.tsx');
    const { playgroundPath } = await server.ssrLoadModule('/content/routes.ts');
    const playgrounds = chartEntries.flatMap((entry) => [
      playgroundPath(entry.id),
      ...(entry.variants ?? []).map((variant) => playgroundPath(entry.id, variant.id)),
    ]);
    for (const path of playgrounds) write(htmlFile(path), page(path, headFor(path, origin)));

    // The not-found page has no canonical, no Markdown twin and says noindex (see headFor).
    write('404.html', page('/not-found', headFor('/not-found', origin)));

    const redirects = legacyRedirects();
    for (const { from, to } of redirects) {
      const url = `${origin}${to}`;
      write(
        htmlFile(from),
        `<!doctype html>\n<html lang="en"><head><meta charset="utf-8" /><title>Moved to ${esc(url)}</title><meta name="robots" content="noindex" /><link rel="canonical" href="${esc(url)}" /><meta http-equiv="refresh" content="0; url=${esc(to)}" /></head><body><p>This page has moved to <a href="${esc(to)}">${esc(to)}</a>.</p></body></html>\n`,
      );
    }

    const agentFiles = await generateAgentFiles((id) => server.ssrLoadModule(id), origin);
    for (const file of agentFiles) write(file.path.replace(/^\//, ''), file.body);

    // The content types of the agent files, for the production host (Netlify
    // and Cloudflare Pages read _headers): a .md is Markdown in UTF-8, not a
    // download or Latin-1. One rule per file, so no two rules ever stack.
    write('_headers', [...agentFiles.flatMap((file) => [file.path, `  Content-Type: ${file.contentType}`]), ''].join('\n'));

    write(
      '_redirects',
      [
        ...redirects.flatMap(({ from, to }) => [`${from} ${to} 301`, `${markdownPath(from)} ${markdownRedirectTarget(to)} 301`]),
        '',
      ].join('\n'),
    );

    const problems = [];
    if (check) {
      const titles = new Map();
      for (const p of pages) {
        const html = readFileSync(join(out, htmlFile(p.path)), 'utf-8');
        const text = html.replace(/<[^>]*>/g, '');
        const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
        const fail = (msg) => problems.push(`${p.path}: ${msg}`);
        if (h1 !== 1) fail(`${h1} <h1> elements`);
        if (!html.includes(`<div id="root">${bodies.get(p.path)}</div>`)) fail('the HTML file does not hold the prerendered body as rendered');
        const title = html.match(/<title>([^<]*)<\/title>/g) ?? [];
        if (title.length !== 1) fail(`${title.length} <title> tags`);
        titles.set(title[0], [...(titles.get(title[0]) ?? []), p.path]);
        if (!html.includes(`<link rel="canonical" href="${origin}${p.path}" />`)) fail('missing canonical');
        if (!html.includes(`<link rel="alternate" type="text/markdown" href="${origin}${markdownPath(p.path)}" />`)) fail('missing markdown alternate');
        if (!html.includes('name="description"') || !html.includes('property="og:title"')) fail('missing description or og tags');
        if ((html.match(/name="description"/g) ?? []).length !== 1) fail('duplicate description');
        if (!html.includes(`<meta property="og:image" content="${origin}/og.png" />`) || !html.includes('<meta name="twitter:card" content="summary_large_image" />')) fail('missing og:image or twitter:card');
        const needsInstall = p.path.startsWith('/docs/components/') || ['/docs/quick-start'].includes(p.path);
        if (needsInstall && !/npm install/.test(text.replace(/\s+/g, ' '))) fail('no install command in the HTML');
        // Install tabs: every package manager's command is in the HTML, not only the chosen one.
        if (['/', '/docs/quick-start'].includes(p.path)) {
          for (const command of [`npm install ${BRAND.packageName}`, `pnpm add ${BRAND.packageName}`, `yarn add ${BRAND.packageName}`, `bun add ${BRAND.packageName}`]) {
            if (!text.includes(command)) fail(`install command "${command}" is not in the HTML`);
          }
        }
        if (/<div id="root"><\/div>/.test(html)) fail('empty #root');
        if (!html.includes(`${TRACKING.gtmScript}?id=${TRACKING.gtmId}`)) fail('no tracking snippet');
      }
      for (const [title, paths] of titles) if (paths.length > 1) problems.push(`duplicate title ${title}: ${paths.join(', ')}`);
    }
    if (check) {
      for (const path of playgrounds) {
        const html = readFileSync(join(out, htmlFile(path)), 'utf-8');
        if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) problems.push(`${path}: not one <h1>`);
        if (/Page not found/.test(html)) problems.push(`${path}: rendered as not found`);
      }
    }
    if (check) {
      problems.push(...checkAgentFiles(pages, markdownPath, origin, BRAND));
      // Over HTTP, as an agent reads it: every llms.txt link and every link in every .md.
      const { checkServed } = await import('./served-check.mjs');
      const served = await checkServed(out);
      problems.push(...served.problems);
      console.log(`site: fetched ${served.fetched} URLs from the built site over HTTP`);
      const notFound = readFileSync(join(out, '404.html'), 'utf-8');
      if (/rel="alternate"/.test(notFound)) problems.push('404.html: has a Markdown alternate');
      if (!/<meta name="robots" content="noindex" \/>/.test(notFound)) problems.push('404.html: no noindex');
      if (/rel="canonical"/.test(notFound)) problems.push('404.html: has a canonical link');
    }
    // The JavaScript each page loads: its own chunks are preloaded, nothing that
    // is meant to load on demand is, and the total stays inside its budget.
    const kinds = new Map();
    for (const path of [...pages.map((p) => p.path), ...playgrounds]) {
      const sources = pageSources(path);
      const kind = sources.join(' + ');
      if (sources.length && !kinds.has(kind)) kinds.set(kind, path);
      if (!check) continue;
      const html = readFileSync(join(out, htmlFile(path)), 'utf-8');
      const scripts = pageScripts(html);
      const fail = (msg) => problems.push(`${path}: ${msg}`);
      if (!sources.length) fail('no chunk for its page module');
      for (const source of sources) {
        if (!manifest[source]) fail(`no chunk for ${source}`);
        else if (!scripts.includes(manifest[source].file)) fail(`its chunk ${manifest[source].file} (${source}) is not preloaded`);
      }
      for (const key of onDemand) if (scripts.includes(manifest[key].file)) fail(`loads ${key} up front`);
      const kb = pageScriptBytes(html) / 1024;
      const budget = SCRIPT_BUDGET_KB[pageDrawsCharts(path) ? 'charts' : 'text'];
      if (kb > budget) fail(`loads ${kb.toFixed(0)} KB of gzipped JavaScript, over the ${budget} KB budget for a page ${pageDrawsCharts(path) ? 'with' : 'without'} charts`);
    }
    if (check && onDemand.length < 2) problems.push('xlsx and dom-to-image-more are no longer chunks of their own: every page now loads them');
    const loads = [...kinds.values()].map((path) => `${path} ${(pageScriptBytes(readFileSync(join(out, htmlFile(path)), 'utf-8')) / 1024).toFixed(0)} KB`);
    console.log(`site: JavaScript on load, gzipped: ${loads.join(', ')}`);
    console.log(`site: ${pages.length} pages, ${playgrounds.length} playgrounds, ${redirects.length} redirects, origin ${origin}`);
    return problems;
  });
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  }
} finally {
  await server.close();
}
console.log(`site:build done in ${((Date.now() - started) / 1000).toFixed(1)}s -> dist-site/`);
