// Checks the site/STANDARDS.md "must" rules that a reviewer would otherwise
// find by eye, on every page of the built site, in headless Chrome:
//   - no console error, failed request or uncaught exception
//   - no sideways scroll at 1440 and 390 px
//   - one <h1>, and no heading level skipped
//   - WCAG AA contrast for every visible piece of text (4.5:1, or 3:1 when large)
//   - an accessible name on every link, button, form control and chart canvas
//   - every keyboard stop visible when focused; the skip link first, to a real target
//   - charts: no rotated tick labels on desktop, at most 7 ticks on an axis, no one-entry legend
//     (bar, line and area charts; pies and funnels keep theirs)
//
//   npm run audit                  every page, English, default theme, 1440 and 390
//   npm run audit -- --themes      also German with the Mono theme, and the dark Uluru theme, on chart pages
//   npm run audit -- /docs/why     only the pages given
// Reads dist-site/ (run npm run site:build first) through scripts/site-preview.mjs.
// Exits 1 when anything fails, with one line per finding.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const withThemes = args.includes('--themes');
const only = args.filter((a) => a.startsWith('/'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// As site/settings.tsx stores them: theme and data set between visits, the language for the session.
const SETTINGS_KEY = 'rkit-site-settings';
const LANGUAGE_KEY = 'rkit-site-language';

// ---- Pages: every page in the sitemap, plus one playground per family.
const sitemap = readFileSync(join(root, 'dist-site/sitemap.xml'), 'utf-8');
const pages = only.length
  ? only
  : [
      ...[...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1] || '/').filter((p) => !p.endsWith('.md')),
      '/docs/components/bar-chart/playground',
      '/docs/components/table-paginated/playground',
    ];

// ---- Servers: the static build, and a headless Chrome to drive.
const sitePort = 5400 + Math.floor(Math.random() * 300);
const site = spawn(process.execPath, [join(root, 'scripts/site-preview.mjs')], { env: { ...process.env, PORT: String(sitePort) }, stdio: 'ignore' });
const chromePort = 9700 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), 'rkit-audit-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${chromePort}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });

const waitFor = async (url) => {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {}
    await sleep(150);
  }
  throw new Error(`no answer from ${url}`);
};

let ws;
let seq = 0;
const pending = new Map();
let events = [];
// Chrome has gone quiet part-way through a long run: fail then, rather than wait for ever.
const REPLY_TIMEOUT_MS = 60_000;
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      rej(new Error(`no reply from Chrome to ${method} within ${REPLY_TIMEOUT_MS / 1000} s`));
    }, REPLY_TIMEOUT_MS);
    pending.set(id, {
      res: (value) => (clearTimeout(timer), res(value)),
      rej: (error) => (clearTimeout(timer), rej(error)),
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

// ---- The checks that run inside the page. One function, serialised.
const inPage = async (opts) => {
  const out = [];
  const say = (rule, detail) => out.push({ rule, detail });
  const describe = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls ? `.${cls}` : ''}`;
  };
  const hiddenFromAll = (el) => Boolean(el.closest('[aria-hidden="true"], [hidden], template, noscript'));
  const visible = (el) => {
    if (hiddenFromAll(el)) return false;
    const rects = el.getClientRects();
    if (!rects.length) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    }
    return true;
  };
  const opacity = (el) => {
    let o = 1;
    for (let a = el; a; a = a.parentElement) o *= Number(getComputedStyle(a).opacity);
    return o;
  };

  // Sideways scroll.
  if (document.documentElement.scrollWidth > innerWidth + 1) say('overflow', `page is ${document.documentElement.scrollWidth}px wide at ${innerWidth}px`);

  if (opts.structure) {
    // Headings.
    const headings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => !hiddenFromAll(h) && h.getAttribute('role') !== 'presentation');
    const h1s = headings.filter((h) => h.tagName === 'H1');
    if (h1s.length !== 1) say('h1', `${h1s.length} <h1> elements`);
    let last = 0;
    for (const h of headings) {
      const level = Number(h.tagName[1]);
      if (last && level > last + 1) say('heading-order', `h${last} then h${level}: "${h.textContent.trim().slice(0, 50)}"`);
      last = level;
    }

    // Names.
    const nameOf = (el) => {
      const label = el.getAttribute('aria-label');
      if (label?.trim()) return label;
      const by = el.getAttribute('aria-labelledby');
      if (by) return by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
      if (el.id) {
        const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (forLabel?.textContent.trim()) return forLabel.textContent;
      }
      if (el.closest('label')?.textContent.trim()) return el.closest('label').textContent;
      const text = (el.innerText ?? el.textContent ?? '').trim();
      if (text) return text;
      const img = el.querySelector('img[alt], svg title');
      if (img) return img.getAttribute('alt') ?? img.textContent;
      return el.getAttribute('title') ?? '';
    };
    const controls = document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="radio"], [role="combobox"], [role="menuitem"], summary');
    for (const el of controls) if (visible(el) && !nameOf(el).trim()) say('name', `${describe(el)} has no accessible name`);
    for (const canvas of document.querySelectorAll('canvas')) {
      if (!visible(canvas)) continue;
      if (canvas.getAttribute('role') === 'img' && !canvas.getAttribute('aria-label')?.trim()) say('name', `chart canvas has no aria-label`);
    }

    // Keyboard stops: each visible when focused.
    const tabbable = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => el.tabIndex >= 0 && !hiddenFromAll(el) && el.getClientRects().length,
    );
    for (const el of tabbable.slice(0, 400)) {
      el.focus({ preventScroll: true });
      if (document.activeElement !== el) continue;
      // A transparent native checkbox or radio inside a visible label is the usual
      // custom-switch pattern: the label's own track shows the focus.
      const styledInput = el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label') && visible(el.closest('label'));
      if (!styledInput && (opacity(el) < 0.5 || !visible(el))) say('focus', `${describe(el)} takes focus while invisible ("${(el.textContent ?? '').trim().slice(0, 30)}")`);
    }
    document.activeElement?.blur?.();

    // Skip link: the first stop, to a target that can take focus.
    const first = tabbable[0];
    if (!first?.classList.contains('skip-link')) say('skip-link', `first keyboard stop is ${first ? describe(first) : 'nothing'}`);
    else {
      const target = document.querySelector(first.getAttribute('href'));
      if (!target) say('skip-link', `target ${first.getAttribute('href')} does not exist`);
      else if (target.getAttribute('tabindex') !== '-1') say('skip-link', 'target cannot take focus (no tabindex="-1")');
      else if (target.querySelector('.docs-sidebar, nav[aria-label="Documentation"]')) say('skip-link', 'target holds the sidebar');
    }
  }

  // Contrast of every visible text.
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
  };
  const background = (el) => {
    const layers = [];
    for (let a = el; a; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('url')) return null; // a gradient: cannot judge
      const bg = parse(cs.backgroundColor);
      if (bg && bg[3] > 0) {
        layers.push(bg);
        if (bg[3] >= 1) break;
      }
    }
    let colour = [255, 255, 255, 1];
    for (const layer of layers.reverse()) colour = over(layer, colour);
    return colour;
  };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || seen.has(el) || el.closest('svg, canvas, script, style')) continue;
    seen.add(el);
    if (!visible(el) || el.closest('button[disabled], [aria-disabled="true"]')) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bg = background(el);
    if (!fg || !bg) continue;
    const shown = over([fg[0], fg[1], fg[2], fg[3] * opacity(el)], bg);
    const [hi, lo] = [lum(shown), lum(bg)].sort((x, y) => y - x);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5) - 0.01) say('contrast', `${ratio.toFixed(2)}:1 "${node.textContent.trim().slice(0, 40)}" (${describe(el)}, ${size}px)`);
  }

  // Charts. The build keeps Chart.js in a chunk of its own (vite.config.ts):
  // importing that same URL gives the module the page is using, and with it
  // every chart it has drawn. The export names are minified, so the Chart class
  // is found by its static registry.
  const chunk = performance.getEntriesByType('resource').map((r) => r.name).find((name) => /\/assets\/chartjs-[\w-]+\.js$/.test(name));
  const Chart = chunk ? Object.values(await import(chunk)).find((v) => typeof v === 'function' && v.instances && typeof v.getChart === 'function') : undefined;
  if (chunk && !Chart) say('audit', 'could not find the Chart class in the Chart.js chunk: the chart checks did not run');
  if (Chart) {
    for (const chart of Object.values(Chart.instances)) {
      const title = chart.canvas.getAttribute('aria-label') ?? chart.config.type;
      if (!visible(chart.canvas)) continue;
      for (const scale of Object.values(chart.scales)) {
        if (scale.options.display === false) continue;
        // On a phone, Chart.js tilts long category labels rather than hide them: allowed (STANDARDS.md).
        // A tilted label fails in the default preview (English): another language is a switcher state.
        if (innerWidth >= 768 && opts.defaultLanguage && scale.labelRotation > 0.5) say('chart', `"${title}": ${scale.id} labels rotated ${Math.round(scale.labelRotation)}°`);
        if (scale.type !== 'category' && scale.ticks.length > 7) say('chart', `"${title}": ${scale.ticks.length} ticks on ${scale.id}`);
      }
      const type = chart.config.type;
      const items = chart.legend?.legendItems ?? [];
      if (chart.legend?.options.display && ['bar', 'line'].includes(type) && items.length === 1) say('chart', `"${title}": a legend with one entry`);
    }
    if (opts.expectCharts && !Object.keys(Chart.instances).length) say('audit', 'no chart was drawn on a page that should have some');
  } else if (opts.expectCharts) say('audit', 'the page loaded no Chart.js chunk');
  return out;
};

// Pages that must draw at least one canvas chart: guards the chart checks against passing because they found nothing.
const mustDrawCharts = (path) => path === '/' || path === '/docs/components' || path === '/examples' || /\/docs\/components\/(bar|line|area|pie|donut|funnel|scatter|bubble)[\w-]*$/.test(path);

const visit = async (path, { width, height = 900, theme = 'default', lang = 'en', structure = true }) => {
  events = [];
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url: `http://localhost:${sitePort}/` });
  await sleep(300);
  await evaluate(`localStorage.setItem(${JSON.stringify(SETTINGS_KEY)}, ${JSON.stringify(JSON.stringify({ themeId: theme, datasetId: 'saas' }))}); sessionStorage.setItem(${JSON.stringify(LANGUAGE_KEY)}, ${JSON.stringify(JSON.stringify({ languageId: lang }))}); 1`);
  events = [];
  await send('Page.navigate', { url: `http://localhost:${sitePort}${path}` });
  await sleep(1800);
  // Scroll the whole page so every lazily mounted chart mounts and draws.
  await evaluate(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 900)); return 1; })()`);
  const findings = await evaluate(`(${inPage.toString()})(${JSON.stringify({ structure, defaultLanguage: lang === 'en', expectCharts: mustDrawCharts(path) })})`);
  for (const e of events) findings.push({ rule: 'console', detail: e });
  return findings;
};

const failures = [];
try {
  await waitFor(`http://localhost:${sitePort}/`);
  const list = await (await waitFor(`http://127.0.0.1:${chromePort}/json`)).json();
  ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
    } else if (m.method === 'Runtime.exceptionThrown') events.push(`exception: ${(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).split('\n')[0]}`);
    else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') events.push(`console.error: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)}`);
    else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') events.push(`${m.params.entry.text.slice(0, 160)} ${m.params.entry.url ?? ''}`);
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  // Google Fonts may be unreachable where this runs; the site must not depend on it.
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] });

  const runs = [
    { width: 1440, label: '1440' },
    { width: 390, label: '390', structure: false },
  ];
  for (const path of pages) {
    for (const run of runs) {
      for (const f of await visit(path, run)) failures.push(`${path} [${run.label}] ${f.rule}: ${f.detail}`);
    }
    const chartPage = path === '/' || path.startsWith('/docs/components') || path.startsWith('/examples');
    if (withThemes && chartPage) {
      for (const f of await visit(path, { width: 1440, theme: 'mono', lang: 'de' })) failures.push(`${path} [mono de] ${f.rule}: ${f.detail}`);
      for (const f of await visit(path, { width: 1440, theme: 'uluru' })) failures.push(`${path} [uluru] ${f.rule}: ${f.detail}`);
    }
    process.stdout.write('.');
  }
} finally {
  ws?.close();
  site.kill();
  await new Promise((r) => {
    chrome.once('exit', r);
    chrome.kill();
    setTimeout(r, 3000);
  });
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome can still be letting go of its profile; the OS clears tmp.
  }
}

process.stdout.write('\n');
const unique = [...new Set(failures)];
if (unique.length) {
  console.log(unique.join('\n'));
  console.log(`audit: ${unique.length} findings on ${pages.length} pages`);
  process.exitCode = 1;
} else console.log(`audit: ${pages.length} pages clean`);
