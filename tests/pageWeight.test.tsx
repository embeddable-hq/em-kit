import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { pageDrawsCharts, pageSources } from '../site/App';
import { Markdown } from '../site/components/Markdown';
import { guides, providerNote } from '../site/content/guides';
import { guideChunks, guideDrawsCharts } from '../site/pages/guideChunks';
import { lightMarkdown } from '../site/pages/guideMarkdown';

// A page loads only what it draws: the chart library on pages with charts,
// the Markdown parser on guides whose prose needs it. site:check measures the
// bytes; these check the decisions behind them.

const full = (md: string) => renderToString(<Markdown>{md}</Markdown>);
const light = (md: string) => {
  const nodes = lightMarkdown(md);
  return nodes && renderToString(<>{nodes}</>);
};

const prose = guides.flatMap((guide) =>
  [providerNote(guide), ...guide.blocks.map((block) => ('md' in block && !('live' in block) ? block.md : undefined))]
    .filter((md): md is string => Boolean(md))
    .map((md) => [guide.slug, md] as const),
);

describe('guide prose without the Markdown parser', () => {
  it.each(prose.map(([slug, md], i) => [`${slug} #${i}`, md] as const))('%s draws the same HTML as the parser', (_, md) => {
    const html = light(md);
    if (html !== undefined) expect(html).toBe(full(md));
  });

  it('draws every block of the guides without live charts, so they do not load the parser', () => {
    const needParser = prose.filter(([slug, md]) => !guideDrawsCharts(guides.find((g) => g.slug === slug)!) && !lightMarkdown(md));
    expect(
      needParser.map(([slug, md]) => `${slug}: ${md.slice(0, 80)}`),
      'These blocks load the Markdown parser (about 45 KB gzipped), which takes a text-only guide over its 150 KB budget: write them in the Markdown site/pages/guideMarkdown.tsx draws, or teach it this',
    ).toEqual([]);
  });

  it.each([
    ['paragraphs, bold, code and links', 'A **bold** start, `code`, [a `link`](/docs/x#y) and **[bold link](/b).**\nA second line.\n\nTwo.'],
    ['a list after a paragraph', 'Read these:\n\n- one `a`\n- two [b](/b)\n\nAfter.'],
    ['a numbered list', '1. first\n2. second'],
    ['an aligned table', '| A | B | C |\n|:--|:-:|--:|\n| `x` | **y** | [z](/z) |\n| 1 |  | 3 |'],
    ['a quote of two paragraphs', '> One [x](/x).\n>\n> Two.'],
    ['code with spaces', 'Both ` a ` and `a  b` are code, and so is `  `.'],
    ['text that looks like Markdown but is not', 'It costs 3.5 KB & loads in 2 s > 1 s, (or not).'],
  ])('draws %s like the parser', (_, md) => {
    expect(light(md)).toBe(full(md));
  });

  it.each([
    ['emphasis', 'An *emphasised* word.'],
    ['underscore emphasis', 'An _emphasised_ word.'],
    ['a heading', '## Heading'],
    ['a fence', '```ts\nconst a = 1;\n```'],
    ['HTML', 'A <b>bold</b> word.'],
    ['an escape', 'A \\* star.'],
    ['an image', '![alt](/a.png)'],
    ['a bare URL', 'See https://example.com for more.'],
    ['an email address', 'Write to team@example.com.'],
    ['an entity', 'A &copy; sign.'],
    ['a loose list', '- one\n\n- two'],
    ['a list that does not start at 1', '3. three\n4. four'],
    ['a nested list', '- one\n  - two'],
    ['a list inside a paragraph', 'Text:\n- one'],
    ['a setext heading', 'Title\n---'],
    ['a reference link', '[text][ref]'],
    ['a table with a missing cell', '| A | B |\n|---|---|\n| 1 |'],
    ['a hard line break', 'One  \nTwo'],
    ['an unsafe link', '[x](javascript:alert(1))'],
  ])('leaves %s to the parser', (_, md) => {
    expect(lightMarkdown(md)).toBeUndefined();
  });
});

describe('what each page loads', () => {
  const textGuides = guides.filter((g) => !guideDrawsCharts(g));

  it('some guides are text only, and they load their page and nothing else', () => {
    expect(textGuides.map((g) => g.slug)).toEqual(expect.arrayContaining(['why', 'troubleshooting']));
    for (const guide of textGuides) {
      expect(pageDrawsCharts(`/docs/${guide.slug}`), guide.slug).toBe(false);
      expect(pageSources(`/docs/${guide.slug}`), guide.slug).toEqual(['pages/DocPage.tsx']);
    }
  });

  it('a guide with live charts loads them after its text', () => {
    const guide = guides.find((g) => g.slug === 'quick-start')!;
    expect(guideDrawsCharts(guide)).toBe(true);
    expect(guideChunks(guide).now).toEqual([]);
    expect(guideChunks(guide).later.map((c) => c.source)).toEqual(['pages/guideChartDemos.tsx']);
    expect(pageDrawsCharts('/docs/quick-start')).toBe(true);
    expect(pageSources('/docs/quick-start')).toEqual(['pages/DocPage.tsx', 'pages/guideChartDemos.tsx']);
  });

  it.each([
    ['/', 'pages/Landing.tsx'],
    ['/docs/components', 'pages/ComponentsIndex.tsx'],
    ['/docs/components/bar-chart', 'pages/ComponentDocPage.tsx'],
    ['/docs/components/bar-chart/playground', 'pages/ChartPage.tsx'],
    ['/examples', 'pages/Examples.tsx'],
  ])('%s draws charts: its page and the charts’ theme', (route, source) => {
    expect(pageDrawsCharts(route)).toBe(true);
    expect(pageSources(route)).toEqual([source, 'charts.tsx']);
  });

  it('the not-found page is in the entry, with nothing to load', () => {
    expect(pageSources('/no-such-page')).toEqual([]);
    expect(pageDrawsCharts('/no-such-page')).toBe(false);
  });
});
