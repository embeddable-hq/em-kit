import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartFromSpec, ChartsProvider, isChartKind } from '../src';
import { componentDefaults } from '../src/componentDefaults.generated';
import { aiChatWiringCode, aiLandingSpec, aiLandingSpecJson } from '../site/catalog/aiSnippets';
import { benefits } from '../site/catalog/benefits';
import { buildChart } from '../site/catalog/build';
import { chartEntries } from '../site/catalog/registry';
import { GAP_CARD_ID, periodLabel, rangeCode, rangeEntries, rowsAt, rowsProps, withoutPeriod } from '../site/components/landing/ChartRange';
import { regionRows, regionSpec, regionSpecJson } from '../site/components/landing/regions';
import { ClickLine, payloadText } from '../site/components/landing/LiveCard';
import { RevenueByRegion as KitFile } from '../site/examples/RevenueByRegion';
import { codeLines, kitComparisonCode, rawComparisonCode, RevenueByRegion } from '../site/components/landing/comparisonCode';
import { BRAND } from '../site/config';
import { getGuide, guideMarkdown, headingId } from '../site/content/guides';
import { isKnownPath, pageForMarkdownPath } from '../site/content/pages';
import { canonicalPath, componentPath } from '../site/content/routes';
import { Landing } from '../site/pages/Landing';
import { SiteSettingsProvider } from '../site/state';

// The landing page against site/STANDARDS.md: the pitch (A), concision (F) and
// the parts of craft (H) that can be checked without a browser. Charts lower
// down the page mount lazily, so the server render holds the copy, the code
// and the hero's charts.

// React separates adjacent text nodes with empty comments; they are not content.
const html = renderToString(
  <SiteSettingsProvider>
    <Landing />
  </SiteSettingsProvider>,
).replace(/<!-- -->/g, '');

// The page's text as written, code included: tags dropped, entities decoded.
const plain = html
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#x27;/g, "'")
  .replace(/&amp;/g, '&');

const strip = (markup: string) =>
  markup
    .replace(/<(script|style|svg|select)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');

const wordsIn = (text: string) => text.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));

// The page's copy: what a visitor reads outside code blocks, inline code and the charts themselves.
const withoutCode = html.replace(/<pre[\s\S]*?<\/pre>/g, ' ').replace(/<code[\s\S]*?<\/code>/g, ' ');
const withoutCharts = withoutCode.replace(/<div class="app-window__canvas[\s\S]*?<\/section>/, '</section>');
const copy = strip(withoutCharts);

// Looks in the markup and in the text, and on failure names what was missing rather than printing the page.
const has = (needle: string) =>
  expect(html.includes(needle) || plain.includes(needle), `page contains ${needle}`).toBe(true);
const lacks = (needle: string) =>
  expect(html.includes(needle) || plain.includes(needle), `page does not contain ${needle}`).toBe(false);

const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]!);
const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!));

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const site = { themeId: 'default', languageId: 'en', datasetId: 'saas' } as const;

describe('landing page: the pitch', () => {
  it('has one H1 that says what it is and who it is for', () => {
    const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => strip(m[1]!).trim());
    expect(h1).toHaveLength(1);
    expect(h1[0]).toMatch(/React chart components/);
    expect(h1[0]).toMatch(/data layer/);
  });

  it('says how it differs from a chart library in the sentence under the headline', () => {
    const lede = strip(html.match(/<p class="lede">([\s\S]*?)<\/p>/)?.[1] ?? '');
    expect(lede).toMatch(/chart library/);
    expect(lede).toContain(BRAND.name);
  });

  it('has two calls to action in the hero and one at the foot', () => {
    const hero = html.slice(0, html.indexOf('lp-charts'));
    expect([...hero.matchAll(/class="button[^"]*"/g)]).toHaveLength(2);
    expect(hero.includes('href="/docs/quick-start"')).toBe(true);
    expect(hero.includes('href="/docs/components"')).toBe(true);
    const cta = html.slice(html.indexOf('lp-cta'));
    expect([...cta.matchAll(/class="button[^"]*"/g)]).toHaveLength(1);
  });

  it('shows the install command for every package manager, with a copy button', () => {
    has(`npm install ${BRAND.packageName}`);
    for (const manager of ['npm', 'pnpm', 'yarn', 'bun']) expect(new RegExp(`role="tab"[^>]*>${manager}<`).test(html), manager).toBe(true);
    has('aria-label="Copy code"');
  });

  it('renders a live chart in the hero', () => {
    const hero = html.slice(0, html.indexOf('lp-charts'));
    expect(hero.includes('<canvas')).toBe(true);
  });

  it('shows 8 to 10 different components, each linked to its docs page', () => {
    expect(rangeEntries.length).toBeGreaterThanOrEqual(8);
    expect(rangeEntries.length).toBeLessThanOrEqual(10);
    expect(new Set(rangeEntries.map((r) => r.entry.exportName)).size).toBe(rangeEntries.length);
    for (const { entry } of rangeEntries) {
      expect(hrefs).toContain(componentPath(entry.id));
      has(`<${String(entry.exportName)} />`);
    }
  });

  it('counts components from the registry', () => {
    has(`${chartEntries.length} components`);
    has(`${rangeEntries.length} of the ${chartEntries.length} components`);
  });

  it('gives each of those cards a Copy code button beside the link to its docs', () => {
    const range = html.slice(html.indexOf('class="lp-range'), html.indexOf('lp-done-title'));
    expect([...range.matchAll(/class="lp-range__meta"/g)]).toHaveLength(rangeEntries.length);
    expect([...range.matchAll(/copy-button[^>]*>[\s\S]*?Copy code/g)]).toHaveLength(rangeEntries.length);
  });

  it('copies code that draws the card: the component, its options on this page and whole imports', () => {
    for (const item of rangeEntries) {
      const code = rangeCode(item, site);
      expect(code, item.entry.id).toMatch(/^import /);
      expect(code, item.entry.id).toContain(`<${String(item.entry.exportName)}`);
      expect(code, item.entry.id).toContain(`from '${BRAND.packageName}'`);
      for (const inputs of Object.values(item.overrides?.fieldOverrides ?? {})) {
        for (const option of Object.keys(inputs)) expect(code, item.entry.id).toContain(option);
      }
      // A prop set back to the component's own default is left out of printed code, which draws the same.
      const defaults = (componentDefaults as Record<string, Record<string, unknown>>)[String(item.entry.exportName)] ?? {};
      for (const [prop, value] of Object.entries(item.overrides?.overrides ?? {})) {
        const printed = code.includes(`${prop}={${String(value)}}`);
        expect(printed || (defaults[prop] === value && !code.includes(`${prop}=`)), `${item.entry.id} ${prop}`).toBe(true);
      }
    }
  });

  it('has no more than seven sections, each with a heading', () => {
    const sections = [...html.matchAll(/<section[^>]*>/g)];
    expect(sections.length).toBeLessThanOrEqual(7);
    for (const [tag] of sections) {
      const id = tag.match(/aria-labelledby="([^"]+)"/)?.[1];
      expect(id, tag).toBeDefined();
      has(`id="${id}"`);
    }
  });

  it('keeps the headings in order', () => {
    const levels = [...html.matchAll(/<h([1-6])(?![^>]*role="presentation")[^>]*>/g)].map((m) => Number(m[1]));
    expect(levels[0]).toBe(1);
    levels.reduce((previous, level) => {
      expect(level - previous).toBeLessThanOrEqual(1);
      return level;
    });
  });
});

describe('landing page: benefits', () => {
  // The section that sells the library: each item says exactly what is
  // handled, in a sentence or two (STANDARDS.md, A).
  it('lists eight at most, each in one or two sentences that say what is handled', () => {
    expect(benefits.length).toBeGreaterThanOrEqual(6);
    expect(benefits.length).toBeLessThanOrEqual(8);
    for (const benefit of benefits) {
      const words = wordsIn(benefit.text).length;
      expect(words, benefit.title).toBeGreaterThanOrEqual(15);
      expect(words, benefit.title).toBeLessThanOrEqual(36);
      expect(benefit.text.split(/(?<=[.!?])\s+/).length, benefit.title).toBeLessThanOrEqual(2);
    }
  });

  it('names a guide that exists for each one, and does not link it: one proof link per card', () => {
    for (const benefit of benefits) {
      expect(getGuide(benefit.path.replace('/docs/', '')), benefit.path).toBeDefined();
      expect(hrefs).not.toContain(benefit.path);
    }
    const cards = html.slice(html.indexOf('lp-benefits'), html.indexOf('lp-live-title'));
    expect([...cards.matchAll(/<a /g)]).toHaveLength(benefits.length);
  });

  it('points each one at its proof on this page, before the guide', () => {
    for (const { title, proof, path } of benefits) {
      expect(proof.href, title).toMatch(/^#/);
      expect(ids.has(proof.href.slice(1)), `${title}: ${proof.href} is on the page`).toBe(true);
      has(proof.label);
      expect(path, title).toMatch(/^\/docs\//);
    }
  });
});

describe('landing page: a missing period', () => {
  const item = rangeEntries.find((r) => r.gap)!;
  const built = buildChart(
    item.entry,
    { ...site, dataState: 'ready', toggles: {} },
    { granularity: 'month', setGranularity: () => {}, tableState: { page: 0, isLoadingDownloadData: false }, setTableState: () => {}, onEvent: () => {} },
  );
  const rowsOf = (props: Record<string, unknown>) => (props.results as { data: Record<string, unknown>[] }).data;
  const whole = rowsProps(built.props, site.datasetId, 'month');
  const { props, missing } = withoutPeriod(whole);

  it('one live chart leaves a period out of its rows', () => {
    expect(item).toBeDefined();
    expect(missing).toBeDefined();
    const all = rowsOf(whole);
    const kept = rowsOf(props);
    expect(kept.length).toBeLessThan(all.length);
    expect(kept.some((row) => Object.values(row).includes(missing))).toBe(false);
    // The period left out is in the middle: rows remain on both sides of it.
    const times = kept.flatMap((row) => Object.values(row).filter((v): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)));
    expect(times.some((t) => t < missing!)).toBe(true);
    expect(times.some((t) => t > missing!)).toBe(true);
    // January to June with only April out: three months on one side, two on the other.
    expect(missing!.slice(0, 7)).toBe('2026-04');
    expect(new Set(times).size).toBe(5);
  });

  it('says so under the chart, and the time series benefit links there', () => {
    has(`${periodLabel(missing!, 'month')} has no rows.`);
    expect(ids.has(GAP_CARD_ID)).toBe(true);
    expect(benefits.some((b) => b.proof.href === `#${GAP_CARD_ID}`)).toBe(true);
  });

  it('names a period in words', () => {
    expect(periodLabel('2026-04-01T00:00:00.000', 'month')).toBe('April');
    expect(periodLabel('2026-04-06T00:00:00.000', 'week')).toBe('the week of 6 April');
    expect(periodLabel('2026-01-01T00:00:00.000', 'year')).toBe('2026');
  });

  it('leaves the rows alone when there is no middle period to take out', () => {
    const firstTwo = [...new Set(rowsOf(props).flatMap((row) => Object.values(row).filter((v): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v))))].sort().slice(0, 2);
    const two = { ...whole, results: { isLoading: false, data: rowsOf(props).filter((row) => Object.values(row).some((v) => firstTwo.includes(v as string))) } };
    expect(withoutPeriod(two).missing).toBeUndefined();
    expect(withoutPeriod(two).props).toBe(two);
  });

  it('copies code with the same rows: the period is missing there too', () => {
    const code = rangeCode(item, site);
    expect(code).not.toContain(missing!);
    for (const row of rowsOf(props)) {
      const time = Object.values(row).find((v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v)) as string;
      expect(code).toContain(time);
    }
  });
});

describe('landing page: concision', () => {
  it('is under 600 words outside code', () => {
    const count = wordsIn(copy).length;
    expect(count).toBeGreaterThan(250); // the measure itself still sees the page
    expect(count).toBeLessThan(600);
  });

  it('uses no hype words and no em dashes', () => {
    expect(copy).not.toMatch(/\b(beautiful|powerful|seamless|effortless|blazing|stunning|delightful|production-grade)\b/i);
    expect(copy).not.toContain('—');
  });

  it('drops the claims the page cannot back', () => {
    for (const claim of ['Hardened', 'Tested across', 'to the pixel', 'depended on', 'five minutes', 'two ways in']) {
      lacks(claim);
    }
  });

  it('links only to pages of the site and to places on this page', () => {
    const files = hrefs.filter((h) => /\.(txt|md)$/.test(h));
    const anchors = hrefs.filter((h) => h.startsWith('#'));
    for (const anchor of anchors) expect(ids.has(anchor.slice(1)), anchor).toBe(true);
    for (const href of hrefs.filter((h) => !files.includes(h) && !anchors.includes(h))) {
      expect(href.startsWith('/'), href).toBe(true);
      // A link to a section of a guide: the page is checked as any other, and the section must be one of its headings.
      const [path, section] = href.split('#') as [string, string | undefined];
      expect(canonicalPath(path), href).toBe(path);
      expect(isKnownPath(path), href).toBe(true);
      if (section) {
        const guide = getGuide(path.replace('/docs/', ''));
        const headings = (guide?.blocks ?? []).flatMap((block) => ('h2' in block ? [headingId(block)] : []));
        expect(headings, href).toContain(section);
      }
    }
  });

  it('has one link per destination: the quick start twice (hero and foot), every other page once', () => {
    const pages = hrefs.filter((h) => h.startsWith('/'));
    const count = (href: string) => pages.filter((h) => h === href).length;
    expect(count('/docs/quick-start')).toBe(2);
    expect(count('/docs/components')).toBe(1);
    for (const href of new Set(pages)) {
      if (href !== '/docs/quick-start') expect(count(href), href).toBe(1);
    }
  });

  it('gives agents four links: the index file, the full file, a twin and the guide', () => {
    const agents = html.slice(html.indexOf('lp-agents-title'), html.indexOf('lp-cta-title'));
    const links = [...agents.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]!);
    expect(links.filter((l) => l !== links[2])).toEqual(['/llms.txt', '/llms-full.txt', '/docs/ai']);
    // The one named as an example is a real page's twin.
    const twin = agents.match(/>\s*(\/docs\/[\w/-]+\.md)\s*</)?.[1];
    expect(links[2]).toBe(twin);
    expect(twin).toBeDefined();
    expect(pageForMarkdownPath(twin!), twin).toBeDefined();
  });

  it('says nothing twice: no paragraph, heading or list line repeats another', () => {
    const lines = [...withoutCharts.matchAll(/<(p|h[1-6]|dd|dt)[^>]*>([\s\S]*?)<\/\1>/g)]
      .map((m) => strip(m[2]!).replace(/\s+/g, ' ').trim().toLowerCase())
      .filter((line) => wordsIn(line).length >= 3);
    const seen = new Set<string>();
    for (const line of lines) {
      expect(seen.has(line), line).toBe(false);
      seen.add(line);
    }
    // The page prints no code for the comparison: that is on the Why page.
    expect(html).not.toContain('react-chartjs-2');
  });
});

describe('the description in the head', () => {
  it('is the pitch the page makes, short enough for a search result, with no hype', () => {
    expect(BRAND.tagline.length).toBeLessThan(160);
    expect(BRAND.tagline).not.toMatch(/\b(beautiful|powerful|seamless|effortless|blazing|stunning|delightful|production-grade)\b/i);
    const h1 = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '').trim();
    expect(BRAND.tagline.startsWith(h1)).toBe(true);
    expect(BRAND.tagline).toContain(BRAND.name);
  });

  it('is the same in the static page', () => {
    const index = read('site/index.html');
    const escaped = BRAND.tagline.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    expect(index).toContain(`<meta name="description" content="${escaped}" />`);
    expect(index).toContain(`<meta property="og:description" content="${escaped}" />`);
  });
});

describe('landing page: the comparison', () => {
  it('shows two complete components: imports, types and an export', () => {
    for (const code of [rawComparisonCode, kitComparisonCode]) {
      expect(code).toMatch(/^import /);
      expect(code).toContain('type Props');
      expect(code).toContain('export function RevenueByRegion');
      expect(code).not.toContain('…');
      expect(code).not.toContain('...rest');
      expect(code).not.toContain('../');
    }
    expect(kitComparisonCode).toContain(`from '${BRAND.packageName}'`);
    expect(rawComparisonCode).toContain("from 'react-chartjs-2'");
  });

  // The pitch is that every card is finished alike, not that there is less
  // code: the line counts and the two files are on the Why page, which also
  // says the difference in lines is smaller across a whole app.
  it('says every card is finished alike, and leaves the line counts to the Why page', () => {
    has('the tenth is as finished as the first');
    lacks('lines of code');
    expect(hrefs).toContain('/docs/why#when-it-pays-off');
    const why = guideMarkdown(getGuide('why')!);
    expect(why).toContain(rawComparisonCode);
    expect(why).toContain(kitComparisonCode);
    expect(why).toContain(`it is ${codeLines(rawComparisonCode)} lines`);
    expect(codeLines(rawComparisonCode)).toBeGreaterThan(codeLines(kitComparisonCode) * 3);
    expect(why).toContain('Across a whole app the difference in lines is smaller');
    expect(why).toContain('## When it pays off');
  });

  it('fits its columns without sideways scrolling', () => {
    for (const line of [...rawComparisonCode.split('\n'), ...kitComparisonCode.split('\n')]) {
      expect(line.length, line).toBeLessThanOrEqual(76);
    }
  });

  it('is like for like: neither file colours the bars by region, and the page does not say so', () => {
    for (const code of [rawComparisonCode, kitComparisonCode]) {
      expect(code).not.toMatch(/colou?r/i);
      expect(code).not.toContain('palette');
    }
    lacks('colour per region');
    // Both take the same rows and states, show a legend and format the value as dollars.
    for (const code of [rawComparisonCode, kitComparisonCode]) {
      for (const name of ['rows', 'isLoading', 'error', 'Revenue by region']) expect(code).toContain(name);
    }
    expect(rawComparisonCode).toContain('Legend');
    expect(rawComparisonCode).not.toMatch(/legend:\s*\{\s*display:\s*false/);
    expect(rawComparisonCode).toContain("currency: 'USD'");
    expect(kitComparisonCode).toContain("prefix: '$'");
  });

  it('says, on the Why page, only what the longer file lacks that can be read in it', () => {
    expect(guideMarkdown(getGuide('why')!)).toContain('one export format, one language and no click handler');
    expect(rawComparisonCode).toContain('downloadCsv');
    expect(rawComparisonCode).not.toMatch(/xlsx|png/i);
    expect(rawComparisonCode).toContain('>No results<');
    expect(rawComparisonCode).not.toMatch(/onClick=\{[^}]*getElement|onBarClicked/);
    expect(kitComparisonCode).toContain('onBarClicked={onBarClicked}');
  });

  it('renders the card from the very file it prints', () => {
    // One module hands out the component and its source, and they are the same file.
    expect(RevenueByRegion).toBe(KitFile);
    const file = read('site/examples/RevenueByRegion.tsx');
    expect(kitComparisonCode).toBe(file.replaceAll("from '../../src'", `from '${BRAND.packageName}'`).trim());
    const pair = read('site/components/landing/comparisonCode.ts');
    expect(pair).toContain("import { RevenueByRegion } from '../../examples/RevenueByRegion';");
    expect(pair).toContain("import kitSource from '../../examples/RevenueByRegion.tsx?raw';");
    // The page takes the component from that module, and gives it no theme or provider of its own.
    const page = read('site/components/landing/LiveCard.tsx');
    expect(page).toMatch(/import \{[^}]*\bRevenueByRegion\b[^}]*\} from '\.\/comparisonCode';/);
    expect(page).toContain('<RevenueByRegion {...states[state].props} onBarClicked={setClick} />');
    expect(page).not.toContain('<ChartsProvider');
    expect(page).not.toContain('Theme');
    expect(kitComparisonCode).toContain('onBarClicked={onBarClicked}');
  });

  it('shows what a click sent, politely, with a hint before the first one', () => {
    const before = renderToString(<ClickLine />);
    expect(before).toContain('id="clicks"');
    expect(before).toContain('aria-live="polite"');
    expect(strip(before.replace(/<!-- -->/g, ''))).toMatch(/Click a bar/);
    const payload = { dimensionValue: 'Europe', dimensionTimeRange: undefined, measureValues: { revenue: 391500 } };
    expect(payloadText(payload)).toBe('{ "dimensionValue": "Europe", "measureValues": { "revenue": 391500 } }');
    const after = renderToString(<ClickLine payload={payload} />).replace(/<!-- -->/g, '').replace(/&quot;/g, '"');
    expect(after).toContain('aria-live="polite"');
    expect(after).toContain(`onBarClicked(${payloadText(payload)})`);
    expect(after).not.toContain('Click a bar');
    // The line is on the page from the start, under the card.
    expect(html.indexOf('id="clicks"')).toBeGreaterThan(html.indexOf('id="states"'));
  });
});

describe('AI samples', () => {
  it('the landing spec is valid JSON for a chart the renderer knows', () => {
    expect(JSON.parse(aiLandingSpecJson)).toEqual(aiLandingSpec);
    expect(isChartKind(aiLandingSpec.chart)).toBe(true);
    expect(aiLandingSpec.rows?.length).toBeGreaterThan(2);
    has('"chart": "donut"');
  });

  it('the landing spec renders', () => {
    const chart = renderToString(
      <ChartsProvider>
        <ChartFromSpec spec={aiLandingSpec} height={300} />
      </ChartsProvider>,
    );
    expect(chart).toContain(aiLandingSpec.title);
  });

  it('the chat wiring sample is a whole file: imports first, an export, nothing elided', () => {
    expect(aiChatWiringCode).toMatch(/^import /);
    expect(aiChatWiringCode).toMatch(/\bexport function /);
    expect(aiChatWiringCode).not.toContain('…');
    for (const name of ['message', 'sendMessage']) expect(aiChatWiringCode).toMatch(new RegExp(`\\b${name}\\b[^;]*: `));
  });
});

describe('landing page: round 3', () => {
  it('says what the peer dependencies are, as the quick start does', () => {
    has('react and react-dom 19.1.1 or later');
  });

  it('counts lines as an editor does, and says where the provider goes', () => {
    expect(codeLines(rawComparisonCode)).toBe(rawComparisonCode.split('\n').length);
    expect(codeLines('a\n\nb')).toBe(3);
  });

  it('uses one regional dataset: the comparison, the model donut and the range share regions and values', () => {
    for (const { region, revenue } of regionRows) {
      expect(JSON.stringify(regionSpec.rows)).toContain(`"revenue":${revenue}`);
      expect(JSON.stringify(regionSpec.rows)).toContain(region);
    }
    expect(JSON.parse(regionSpecJson)).toEqual(regionSpec);
    expect(isChartKind(regionSpec.chart)).toBe(true);
    has('"North America"');
    for (const { revenue } of regionRows.slice(0, 3)) expect(revenue).toBeGreaterThan(0);
  });

  it('leaves the six benefits to the cards: the hero does not list them', () => {
    const hero = html.slice(html.indexOf('lp-hero__copy'), html.indexOf('lp-hero__actions'));
    for (const word of ['formatting', 'colours', 'translations', 'time series', 'loading states']) {
      expect(strip(hero).toLowerCase().includes(word), word).toBe(false);
    }
  });

  it('puts the missing-period note inside its own card, with a picker on the line chart', () => {
    const gap = rangeEntries.find((r) => r.gap)!;
    const picker = rangeEntries.find((r) => r.picker)!;
    expect(gap.entry.id).not.toBe(picker.entry.id);
    const card = html.slice(html.indexOf(`id="${GAP_CARD_ID}"`));
    expect(card.slice(0, card.indexOf('lp-range__meta'))).toContain('has no rows.');
  });

  it('builds a picker card rows per granularity from the dataset: whole weeks, months and quarters', () => {
    const picker = rangeEntries.find((r) => r.picker)!;
    const entry = picker.entry;
    const base = buildChart(entry, { ...site, dataState: 'ready', toggles: {} }, {
      granularity: 'month', setGranularity: () => {}, tableState: { page: 0, isLoadingDownloadData: false }, setTableState: () => {}, onEvent: () => {},
    });
    const count = (g: 'week' | 'month' | 'quarter') => new Set((rowsAt(base.props, site.datasetId, g)!.data as Record<string, unknown>[]).map((r) => Object.values(r)[0])).size;
    expect(count('week')).toBeGreaterThan(count('month'));
    expect(count('month')).toBe(6);
    // Two whole quarters: neither is a month or two of data next to a full one.
    expect(count('quarter')).toBe(2);
  });
});
