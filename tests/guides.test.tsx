import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { BarChartStacked, ChartsProvider, dimension, measure, results } from '../src';
import type { Dimension } from '../src';
import { getBarStackedChartProData, getLineChartProData, getThemeFormatter, useChartsTheme, useFillGaps } from '../src/build';
import { installCommand, packageManagers } from '../site/components/InstallCommand';
import { BRAND } from '../site/config';
import { getGuide, Guide, GuideBlock, guideAliases, guideMarkdown, guides, headingId, markdownAnchor, providerNote } from '../site/content/guides';
import { llmsFullTxt, llmsTxt } from '../site/content/llms';
import { componentProps } from '../site/generated/props';
import { getEntryBySlug } from '../site/content/routes';
import App from '../site/examples/App';
import { SpanishCharts } from '../site/examples/SpanishCharts';
import { TranslatedChart } from '../site/examples/TranslatedChart';
import { componentFieldOptions } from '../site/generated/props';
import { DocPage } from '../site/pages/DocPage';
import { SiteSettingsProvider } from '../site/state';

// The guides are the site's teaching pages. These checks hold them to
// site/STANDARDS.md: code that runs as pasted, a quick start with a chart on
// it, nothing said twice, and nothing claimed that the library does not do.

type CodeBlock = Extract<GuideBlock, { code: string }>;
type Located<T> = { guide: Guide; block: T };

const located = <T extends GuideBlock>(is: (b: GuideBlock) => b is T): Located<T>[] =>
  guides.flatMap((guide) => guide.blocks.filter(is).map((block) => ({ guide, block })));

const codeBlocks = located((b): b is CodeBlock => 'code' in b);
const scriptBlocks = codeBlocks.filter(({ block }) => ['tsx', 'ts'].includes(block.lang ?? 'tsx'));
const proseBlocks = located((b): b is { md: string } => 'md' in b && !('live' in b));

const label = ({ guide, block }: Located<CodeBlock>) => `${guide.slug} / ${block.file ?? block.code.split('\n')[0]}`;

const guideOf = (slug: string) => {
  const guide = getGuide(slug);
  if (!guide) throw new Error(`No guide "${slug}"`);
  return guide;
};

const h2s = (guide: Guide) => guide.blocks.filter((b): b is { h2: string; id?: string } => 'h2' in b);

describe('guide code', () => {
  it.each(scriptBlocks.map((b) => [label(b), b.block] as const))('%s parses', (_, block) => {
    const { diagnostics } = ts.transpileModule(block.code, {
      fileName: `block.${block.lang ?? 'tsx'}`,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    expect((diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  });

  it.each(codeBlocks.map((b) => [label(b), b.block] as const))('%s has no placeholder', (_, block) => {
    expect(block.code).not.toContain('…');
    expect(block.code).not.toMatch(/\/\*\s*\.\.\.\s*\*\/|\/\/\s*\.\.\.\s*$/m);
  });

  // The docs column fits about 98 characters of code; longer lines scroll sideways.
  it.each(scriptBlocks.map((b) => [label(b), b.block] as const))('%s fits the page', (_, block) => {
    expect(block.code.split('\n').filter((line) => line.length > 96)).toEqual([]);
  });

  // A component sample is a real file in site/examples, so `tsc` checks its
  // imports, names and props against the library.
  it('every tsx sample is a file in site/examples', () => {
    const dir = join(__dirname, '../site/examples');
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .map((f) =>
        readFileSync(join(dir, f), 'utf8')
          .replace(/from '\.\.\/\.\.\/src\/(\w+)'/g, `from '${BRAND.packageName}/$1'`)
          .replace(/from '\.\.\/\.\.\/src'/g, `from '${BRAND.packageName}'`)
          .trim(),
      );
    for (const located of codeBlocks.filter(({ block }) => (block.lang ?? 'tsx') === 'tsx')) {
      expect(files, label(located)).toContain(located.block.code);
    }
  });

  it('a sample that renders a chart imports it from the package and has its data', () => {
    for (const { block } of scriptBlocks.filter(({ block }) => /results=\{/.test(block.code))) {
      expect(block.code).toMatch(new RegExp(`from '${BRAND.packageName}'`));
      // Its data is in the file, or (the Why page's card) arrives as the `rows` prop it declares.
      expect(block.code).toMatch(/const \w+(: [\w<>[\]]+)? = (\[|names\.map|Array\.from)|ordersBy|fetchCustomers|rows\?: \{/);
    }
  });
});

describe('quick start', () => {
  const guide = guideOf('quick-start');

  it('is three numbered steps: install, provider, chart', () => {
    expect(h2s(guide).map((h) => h.h2)).toEqual(['1. Install', '2. Add the provider', '3. Render a chart', 'Next steps']);
  });

  it('shows the install command for every package manager and states the peer dependencies', () => {
    const markdown = guideMarkdown(guide);
    for (const manager of packageManagers) expect(markdown).toContain(installCommand(manager));
    expect(markdown).toMatch(/`react` and `react-dom`/);
  });

  it('renders the chart directly under the code that defines it', () => {
    const index = guide.blocks.findIndex((b) => 'code' in b && b.file === 'RevenueChart.tsx');
    expect(index).toBeGreaterThan(-1);
    expect(guide.blocks[index + 1]).toMatchObject({ live: 'quick-start-chart' });
    const code = (guide.blocks[index] as CodeBlock).code;
    expect(code).toContain(`from '${BRAND.packageName}'`);
    expect(code).toContain('const rows = [');
    expect(code).toMatch(/style=\{\{ height: \d+ \}\}/);
  });

  it('runs: the two files together render the chart', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Revenue by region');
    expect(html).toContain('<canvas');
  });
});

describe('guide structure', () => {
  it('lists the pages in the order a newcomer needs', () => {
    expect(guides.filter((g) => g.section === 'Getting started').map((g) => g.slug)).toEqual([
      'quick-start',
      'why',
      'troubleshooting',
    ]);
    expect(guides.filter((g) => g.section === 'Guides').map((g) => g.slug)).toEqual([
      'describing-your-data',
      'time-series',
      'loading-empty-and-errors',
      'events',
      'tables',
      'theming',
      'localisation',
      'card-menu',
      'accessibility',
      'ai',
      'charts-from-a-model',
      'build-your-own-chart',
    ]);
  });

  it('keeps the old AI charts URL working', () => {
    expect(getGuide(guideAliases['ai-charts']!)?.title).toBe('Charts from a model');
  });

  // `Client Components` is React's own error text.
  const allowed = new Set([BRAND.name, 'AI', 'KPIs', 'Chart.js', 'ChatGPT', 'Claude', 'Code', 'Cursor', 'ChartsProvider', 'Client', 'Components']);
  it.each(guides.flatMap((g) => g.blocks.filter((b) => 'h2' in b || 'h3' in b).map((b) => ['h2' in b ? b.h2 : (b as { h3: string }).h3])))(
    'heading "%s" is in sentence case',
    (heading) => {
      const [first, ...rest] = heading.replace(/^\d+\.\s*/, '').split(/\s+/);
      expect(first![0]).toBe(first![0]!.toUpperCase());
      expect(rest.filter((word) => /^[A-Z]/.test(word) && !allowed.has(word.replace(/[:,.]$/, '')))).toEqual([]);
    },
  );

  // Chart cards bring their own headings, so this reads the rendered page.
  it.each(guides.map((g) => [g.slug, g] as const))('%s has one h1 and no skipped heading level', (_, guide) => {
    const html = renderToString(
      <SiteSettingsProvider>
        <DocPage guide={guide} route={`/docs/${guide.slug}`} />
      </SiteSettingsProvider>,
    );
    const levels = [...html.matchAll(/<h([1-6])(?![^>]*role="presentation")[^>]*>/g)].map((m) => Number(m[1]));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    levels.forEach((level, i) => expect(level - (levels[i - 1] ?? 0), `heading ${i + 1} of ${levels.join('')}`).toBeLessThanOrEqual(1));
  });

  it('every internal link goes to a page and a section that exist', () => {
    const known = new Set(['/', '/docs/components', '/examples', '/examples/ai-chat']);
    for (const { guide, block } of [...proseBlocks, ...located((b): b is { live: never; md: string } => 'live' in b)]) {
      for (const [, path, hash] of block.md.matchAll(/\]\((\/[\w/-]*)(#[\w-]+)?\)/g)) {
        const target = getGuide(path!.replace(/^\/docs\//, ''));
        const component = path!.match(/^\/docs\/components\/([\w-]+)$/);
        const exists = known.has(path!) || Boolean(target) || Boolean(component && getEntryBySlug(component[1]!));
        expect(exists, `${guide.slug}: ${path}`).toBe(true);
        if (target && hash) {
          const anchors = [
            ...h2s(target).map((h) => `#${headingId(h)}`),
            ...target.blocks.filter((b): b is Extract<typeof b, { details: string }> => 'details' in b).map((b) => `#${markdownAnchor(b.details)}`),
          ];
          expect(anchors, `${guide.slug}: ${path}${hash}`).toContain(hash);
        }
      }
    }
  });
});

describe('concision', () => {
  it('says nothing twice: no paragraph or code block appears in two places', () => {
    const seen = new Map<string, string>();
    const blocks = [
      ...proseBlocks.filter(({ block }) => block.md.length > 60).map(({ guide, block }) => [guide.slug, block.md] as const),
      ...codeBlocks.map(({ guide, block }) => [guide.slug, block.code] as const),
    ];
    for (const [slug, text] of blocks) {
      expect(seen.get(text), `"${text.slice(0, 60)}" is in ${seen.get(text)} and ${slug}`).toBeUndefined();
      seen.set(text, slug);
    }
  });

  it('keeps the side-by-side code comparison on the Why page only: two files, after the table', () => {
    const why = guideMarkdown(guideOf('why'));
    expect(why.match(/```tsx/g)).toHaveLength(2);
    expect(why).toContain("from 'react-chartjs-2'");
    expect(why.indexOf('| What a dashboard needs |')).toBeLessThan(why.indexOf('```tsx'));
    for (const guide of guides.filter((g) => g.slug !== 'why')) expect(guideMarkdown(guide), guide.slug).not.toContain('react-chartjs-2');
    expect(guideMarkdown(guideOf('quick-start'))).not.toMatch(/^- .*(export|skeleton|colour per value)/im);
  });

  // Tables, lists and callouts are exempt: they are reference, not prose.
  it.each(proseBlocks.filter(({ block }) => !/^(\||- |\d+\. |> )/m.test(block.md)).map(({ guide, block }) => [`${guide.slug}: ${block.md.slice(0, 50)}`, block.md]))(
    '%s is three sentences or fewer',
    (_, md) => {
      const plain = md.replace(/`[^`]*`/g, 'code').replace(/\]\([^)]*\)/g, ']');
      expect(plain.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length).toBeLessThanOrEqual(3);
    },
  );

  it('has no status clutter, hype or em dashes in its prose', () => {
    for (const { guide, block } of proseBlocks) {
      expect(block.md, guide.slug).not.toMatch(/coming soon|roadmap|—|beautiful|powerful|seamless|effortless|blazing/i);
    }
    for (const guide of guides) expect(guide.description).not.toMatch(/—|coming soon/i);
  });
});

describe('markdown twins', () => {
  it.each(guides.map((g) => [g.slug, g] as const))('%s is complete, self-contained Markdown', (_, guide) => {
    const markdown = guideMarkdown(guide);
    expect(markdown.startsWith(`# ${guide.title}\n\n${guide.description}`)).toBe(true);
    expect((markdown.match(/^```/gm) ?? []).length % 2).toBe(0);
    // Every code block of the page is in it, and a live block never leaves a hole.
    for (const block of guide.blocks) if ('code' in block) expect(markdown).toContain(block.code);
    expect(markdown).not.toMatch(/\n{4,}|^undefined$|\[object Object\]/m);
    // Links between docs pages point at the Markdown twins.
    expect(markdown).not.toMatch(/\]\(\/docs\/[\w/-]+(?<!\.md)(#[\w-]+)?\)/);
  });

  it('only the quick start has the install tabs and states the peer dependency', () => {
    for (const guide of guides) {
      const markdown = guideMarkdown(guide);
      expect(markdown.includes(installCommand('pnpm')), guide.slug).toBe(guide.slug === 'quick-start');
      expect(/`react` and `react-dom`/.test(markdown), guide.slug).toBe(guide.slug === 'quick-start');
    }
  });

  it('the old Introduction and Installation URLs redirect to the quick start', () => {
    expect(guideAliases['introduction']).toBe('quick-start');
    expect(guideAliases['installation']).toBe('quick-start');
  });
});

describe('use with AI', () => {
  const markdown = guideMarkdown(guideOf('ai'));

  it('names the endpoints that exist and gives one copyable block per assistant', () => {
    for (const text of [`${BRAND.url}/llms.txt`, `${BRAND.url}/llms-full.txt`, '.md', 'Copy page as Markdown', 'Copy prompt']) {
      expect(markdown).toContain(text);
    }
    expect(h2s(guideOf('ai')).map((h) => h.h2)).toEqual(expect.arrayContaining(['Claude Code', 'Cursor', 'ChatGPT']));
    expect(guideOf('ai').blocks.filter((b) => 'code' in b)).toHaveLength(3);
  });

  it('does not claim an MCP server', () => {
    expect(markdown).not.toMatch(/\bMCP\b/i);
  });

  it('leaves the rendering API to its own guide', () => {
    expect(markdown).not.toContain('ChartFromSpec');
    const model = guideMarkdown(guideOf('charts-from-a-model'));
    for (const name of ['ChartFromSpec', 'renderChartTool', 'chartGuidance', 'intentToPrompt']) expect(model).toContain(name);
  });
});

describe('describing your data', () => {
  const guide = guideOf('describing-your-data');

  it('has the field options reference that component pages link to', () => {
    expect(h2s(guide).map(headingId)).toContain('field-options');
  });

  it('describes every option that all components accept, and the time options', () => {
    const perComponent = Object.values(componentFieldOptions).map(
      (fields) => new Set(Object.values(fields).flatMap((field) => field.inputs.map((input) => input.name))),
    );
    const common = [...perComponent[0]!].filter((name) => perComponent.every((names) => names.has(name)));
    expect(common.length).toBeGreaterThan(5);
    const markdown = guideMarkdown(guide);
    const table = markdown.slice(markdown.indexOf('## Field options'), markdown.indexOf('## The response shape'));
    // `granularity` is set on the dimension itself, so the properties table has it, once.
    for (const name of [...common, 'showGranularityDropdown', 'dateBounds', 'ignoreEmptyDate', 'displayNullAs']) {
      expect(table, name).toContain(`\`${name}\``);
    }
  });
});

describe('accessibility', () => {
  it('has a key table and says what is left to the developer', () => {
    const guide = guideOf('accessibility');
    expect(guide.section).toBe('Guides');
    expect(h2s(guide).map(headingId)).toEqual(expect.arrayContaining(['charts', 'kpis', 'tables', 'keyboard', 'checklist']));
    expect(guideMarkdown(guide)).toContain('| Key | Where | What it does |');
  });
});

// The troubleshooting section and the time series guide describe what the
// library does with bad input. These run the library to keep them true.
describe('documented behaviour', () => {
  const revenue = measure({ name: 'revenue', title: 'Revenue', inputs: { currency: 'USD', decimalPlaces: 0 } });
  const month = dimension({ name: 'month', title: 'Month', type: 'time', granularity: 'month' });

  type Drawn = { ticks: string[]; values: unknown[] };
  const draw = (dim: Dimension, rows: Record<string, unknown>[]): Drawn => {
    let drawn: Drawn = { ticks: [], values: [] };
    const Probe = () => {
      const theme = useChartsTheme();
      const filled = useFillGaps({ results: results(rows), dimension: dim });
      const data = getLineChartProData({ data: filled.data, dimension: dim, measures: [revenue], hasMinMaxYAxisRange: false }, theme);
      const format = getThemeFormatter(theme);
      drawn = { ticks: (data.labels ?? []).map((l) => format.data(dim, l)), values: data.datasets[0]?.data ?? [] };
      return null;
    };
    renderToString(
      <ChartsProvider theme={{ formatter: { locale: 'en-US' } }}>
        <Probe />
      </ChartsProvider>,
    );
    return drawn;
  };

  it('throws the documented error outside the provider', () => {
    const message = 'EmKit components must be rendered inside <ChartsProvider>.';
    expect(guideMarkdown(guideOf('troubleshooting'))).toContain(message);
    expect(() => renderToString(<BarChartStacked xAxis={month} groupBy={month} measure={revenue} results={results([])} />)).toThrow(message);
  });

  it('reads a time axis from the plain key, formats it and fills the missing period', () => {
    const drawn = draw(month, [
      { month: '2026-01-01T00:00:00.000', revenue: 48200 },
      { month: '2026-03-01T00:00:00.000', revenue: 55400 },
    ]);
    expect(drawn).toEqual({ ticks: ['Jan 2026', 'Feb 2026', 'Mar 2026'], values: [48200, null, 55400] });
  });

  it('shows a time value with a Z as raw text', () => {
    expect(draw(month, [{ month: '2026-01-01T00:00:00.000Z', revenue: 48200 }]).ticks).toEqual(['2026-01-01T00:00:00.000Z']);
  });

  it('leaves a row off the chart when its time is not the start of the period', () => {
    expect(draw(month, [{ month: '2026-01-15T00:00:00.000', revenue: 48200 }])).toEqual({ ticks: ['Jan 2026'], values: [null] });
  });

  it('reads a time groupBy from the name.granularity key', () => {
    const plan = dimension({ name: 'plan', title: 'Plan' });
    const january = '2026-01-01T00:00:00.000';
    const datasets = (rows: Record<string, unknown>[]) => {
      let count = -1;
      const Probe = () => {
        count = getBarStackedChartProData({ data: rows, dimension: plan, groupDimension: month, measure: revenue }, useChartsTheme()).datasets.length;
        return null;
      };
      renderToString(
        <ChartsProvider>
          <Probe />
        </ChartsProvider>,
      );
      return count;
    };
    expect(datasets([{ plan: 'Starter', month: january, revenue: 18400 }])).toBe(0);
    expect(datasets([{ plan: 'Starter', month: january, 'month.month': january, revenue: 18400 }])).toBe(1);
  });

  it('translates the localisation examples as the guide says', () => {
    expect(renderToString(<TranslatedChart />)).toContain('Umsatz nach Region');
    const empty = renderToString(
      <SpanishCharts>
        <BarChartStacked xAxis={month} groupBy={month} measure={revenue} results={results([])} />
      </SpanishCharts>,
    );
    expect(empty).toContain('Sin resultados.');
  });
});

describe('events: the handler list is the real one', () => {
  const markdown = guideMarkdown(guideOf('events'));
  const handlers = new Map<string, string[]>();
  for (const [component, props] of Object.entries(componentProps)) {
    for (const prop of props) if (/^on[A-Z]\w*Click(ed)?$/.test(prop.name)) handlers.set(prop.name, [...(handlers.get(prop.name) ?? []), component]);
  }

  it('has a row for every handler of every component', () => {
    expect(handlers.size).toBeGreaterThan(5);
    for (const [name, components] of handlers) {
      const row = markdown.split('\n').find((line) => line.startsWith(`| \`${name}\` |`));
      expect(row, name).toBeDefined();
      for (const component of components) expect(row, `${name} on ${component}`).toContain(`\`${component}\``);
    }
  });

  it('gives scatter and bubble charts onPointClick, and says onPointClicked is the area chart’s', () => {
    expect(handlers.get('onPointClick')).toEqual(expect.arrayContaining(['ScatterChart', 'BubbleChart']));
    expect(handlers.get('onPointClicked')).toEqual(['AreaChart']);
    expect(markdown).toContain('`AreaChart` takes `onPointClicked`');
    expect(markdown).toContain('`ScatterChart` and `BubbleChart` take `onPointClick`');
  });
});

describe('use with AI: the routes', () => {
  const markdown = guideMarkdown(guideOf('ai'));

  it('types no size for llms-full.txt, and points to where the generated one is', () => {
    // A typed figure drifted (300 KB against 339): the size is stated only where it is generated.
    expect(markdown).not.toMatch(/llms-full\.txt` \|[^\n]*\d+ KB/);
    expect(markdown).toContain('Its header, and its line in `llms.txt`, give its size.');
    const full = llmsFullTxt();
    const stated = Number(full.match(/^\d+ pages, (\d+) KB\.$/m)![1]);
    expect(Math.abs(stated - new TextEncoder().encode(full).length / 1024)).toBeLessThanOrEqual(1);
    expect(llmsTxt()).toContain(`every page above as one Markdown document, ${stated} KB`);
  });

  it('sends ChatGPT to llms.txt and one component page, not the whole file', () => {
    const prompt = guideOf('ai').blocks.find((b): b is CodeBlock => 'code' in b && b.lang === 'text' && b.code.startsWith('Read '))!;
    expect(prompt.code).toContain(`${BRAND.url}/llms.txt`);
    expect(prompt.code).toMatch(/\/docs\/components\/[\w-]+\.md/);
    expect(prompt.code).not.toContain('llms-full');
  });

  it('gives Cursor the one-link route as well as the rule', () => {
    expect(markdown).toContain(`add \`${BRAND.url}/llms-full.txt\` as a doc`);
  });
});

describe('time and provider notes', () => {
  it('guides whose samples have no provider say where it comes from, once and in one place', () => {
    const withNote = guides.filter((g) => providerNote(g));
    expect(withNote.map((g) => g.slug)).toEqual(expect.arrayContaining(['describing-your-data', 'time-series', 'events', 'tables']));
    for (const guide of withNote) {
      expect(guideMarkdown(guide), guide.slug).toContain('The samples assume the `ChartsProvider` from [step 2 of the quick start](/docs/quick-start.md#2-add-the-provider)');
      // Not repeated as a block.
      expect(guide.blocks.filter((b) => 'md' in b && b.md.includes('The samples assume'))).toHaveLength(0);
    }
    for (const slug of ['quick-start', 'theming', 'localisation']) expect(providerNote(guideOf(slug)), slug).toBeUndefined();
  });

  it('describing-your-data says once where granularity is set, and what the chart prop is for', () => {
    const markdown = guideMarkdown(guideOf('describing-your-data'));
    expect(markdown.match(/\| `granularity` \|/g)).toHaveLength(1);
    expect(markdown).toContain('at the top level of `dimension()`');
    expect(markdown).toContain('A chart’s own `granularity` prop');
  });

  it('the time series guide carries the time rules; the quick start, with a category chart, needs none', () => {
    const time = guideMarkdown(guideOf('time-series'));
    expect(time).toContain('The start of its period');
    expect(guideMarkdown(guideOf('quick-start'))).toContain('[Time series](/docs/time-series.md)');
  });
});

describe('troubleshooting: Next.js', () => {
  const guide = guideOf('troubleshooting');
  it('is headed by React’s own error text and gives the fix', () => {
    const index = guide.blocks.findIndex((b) => 'h2' in b && b.h2 === 'An error says createContext only works in Client Components');
    expect(index).toBeGreaterThan(-1);
    const entry = guide.blocks.slice(index + 1, index + 3);
    expect(JSON.stringify(entry)).toContain("use client");
    expect(JSON.stringify(entry)).toContain('ChartsProvider');
  });
});

describe('theming and the model guide', () => {
  it('names the two theming samples differently and lists the theme.charts keys', () => {
    const files = guideOf('theming').blocks.filter((b): b is CodeBlock => 'code' in b).map((b) => b.file);
    expect(new Set(files).size).toBe(files.length);
    const markdown = guideMarkdown(guideOf('theming'));
    expect(markdown).not.toContain('and so on');
    for (const key of ['barChartDefaultPro', 'pieChartPro', 'funnelChartPro', 'lineChartComparisonDefaultPro']) expect(markdown).toContain(`\`${key}\``);
  });

  it('tells the reader to install the Anthropic SDK above chartFor.ts', () => {
    const blocks = guideOf('charts-from-a-model').blocks;
    const install = blocks.findIndex((b) => 'code' in b && b.code === 'npm install @anthropic-ai/sdk');
    const sample = blocks.findIndex((b) => 'code' in b && b.file === 'chartFor.ts');
    expect(install).toBeGreaterThan(-1);
    expect(install).toBeLessThan(sample);
  });
});

describe('troubleshooting: fonts', () => {
  const clear = () => {
    document.head.querySelectorAll('[data-remarkable-google-fonts], [data-remarkable-preconnect], #remarkable-theme-fonts').forEach((n) => n.remove());
  };
  const mount = async (theme?: React.ComponentProps<typeof ChartsProvider>['theme']) => {
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(<ChartsProvider theme={theme}>{null}</ChartsProvider>));
    await act(async () => root.unmount());
  };

  it('the provider requests Inter from Google Fonts by default, as the guide says', async () => {
    clear();
    await mount();
    const link = document.head.querySelector<HTMLLinkElement>('[data-remarkable-google-fonts]');
    expect(link?.href).toContain('https://fonts.googleapis.com/css2?family=Inter');
    expect(document.head.querySelector('link[rel="preconnect"][href="https://fonts.gstatic.com"]')).not.toBeNull();
    const markdown = guideMarkdown(guideOf('troubleshooting'));
    for (const text of ['fonts.googleapis.com', 'fonts.gstatic.com', '`style-src`', '`font-src`']) expect(markdown).toContain(text);
    clear();
  });

  it('the sample turns the request off and declares the self-hosted font', async () => {
    clear();
    await mount({ fonts: { google: [], custom: [{ family: 'Inter', src: '/fonts/inter-variable.woff2', descriptors: { weight: '100 900' } }] } });
    expect(document.head.querySelector('[data-remarkable-google-fonts]')).toBeNull();
    expect(document.getElementById('remarkable-theme-fonts')?.textContent).toContain("font-family: 'Inter'; src: url(/fonts/inter-variable.woff2)");
    const sample = guideOf('troubleshooting').blocks.find((b): b is CodeBlock => 'code' in b && b.file === 'SelfHostedFont.tsx')!;
    expect(sample.code).toContain("google: []");
    expect(sample.code).toContain('/fonts/inter-variable.woff2');
    clear();
  });
});
