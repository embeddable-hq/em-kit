import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chartEntries } from '../site/catalog/registry';
import { installCommand } from '../site/components/InstallCommand';
import { BRAND } from '../site/config';
import { componentPageMarkdown } from '../site/content/components';
import { componentPath } from '../site/content/routes';
import { ComponentDocPage } from '../site/pages/ComponentDocPage';
import { SiteSettingsProvider } from '../site/state';

// A component's HTML page and its Markdown twin, under the rule in
// site/STANDARDS.md ("Settled conflicts between checks"): both hold the code,
// every example's notes, the props and the type shapes. Setup prose (peers,
// provider, height, frameworks, states) is in the twin, which is
// self-contained, and once on the quick start; the HTML page carries the
// install command inline and links there.

const each = chartEntries.map((e) => [e.id, e] as const);

/** Markdown as the text a reader sees: no backticks, links as their words, one space between words. */
const plain = (markdown: string) =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sentences = (paragraph: string) => paragraph.split(/(?<=[.!?][`’”)]?)\s+(?=[A-Z`[])/).map(plain).filter(Boolean);

/** The prose paragraphs of one `## ` section of the twin: not code, tables or lists. */
const section = (markdown: string, heading: string) =>
  (markdown.split(new RegExp(`^## ${heading}$`, 'm'))[1] ?? '')
    .split(/^## /m)[0]!
    .replace(/```[\s\S]*?```/g, '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('|') && !p.startsWith('- ') && !p.startsWith('#'));

const pageText = (entry: (typeof chartEntries)[number]) => {
  const root = document.createElement('div');
  root.innerHTML = renderToString(
    <SiteSettingsProvider>
      <ComponentDocPage entry={entry} route={componentPath(entry.id)} />
    </SiteSettingsProvider>,
  );
  return (root.querySelector('.component-page')!.textContent ?? '').replace(/\s+/g, ' ');
};

describe('component page HTML against its Markdown twin', () => {
  it.each(each)('%s: the page holds the twin’s examples, notes and type shapes, and links its setup', (_, entry) => {
    const markdown = componentPageMarkdown(entry);
    const html = pageText(entry);
    const missing = (texts: string[]) => texts.filter((text) => !html.includes(text));

    // Install: the npm command inline, and a link to the quick start for the rest.
    expect(html).toContain(installCommand('npm'));
    expect(markdown).toContain('## Install');
    expect(section(markdown, 'Install').flatMap(sentences).length).toBeGreaterThanOrEqual(5);

    // Every example's text: what it shows, how, and its notes.
    const examples = (markdown.split(/^## Examples$/m)[1] ?? '').split(/^## /m)[0]!;
    const notes = examples
      .replace(/```[\s\S]*?```/g, '')
      .split(/\n{2,}/)
      .filter((p) => p.trim() && !p.startsWith('#'))
      .flatMap(sentences);
    expect(missing(notes)).toEqual([]);

    // Props: each type the twin spells out, and what it says about them.
    const props = (markdown.split(/^## Props$/m)[1] ?? '').split(/^## Field options$/m)[0]!;
    const shapes = [...props.matchAll(/^type \w+ = (.*)$/gm)].map((m) => m[1]!.replace(/\s+/g, ' '));
    expect(missing(shapes)).toEqual([]);
  });

  it('checks real content: the bar chart page links setup and keeps its notes; the twin has the setup', () => {
    const entry = chartEntries.find((e) => e.id === 'bar')!;
    const html = pageText(entry);
    for (const text of [`npm install ${BRAND.packageName}`, 'Quick start', 'BarChartOptionsClickArg = {']) expect(html, text).toContain(text);
    const markdown = componentPageMarkdown(entry);
    for (const text of ['19.1.1', "'use client'", `pnpm add ${BRAND.packageName}`, 'ChartsProvider']) expect(markdown, text).toContain(text);
  });
});
