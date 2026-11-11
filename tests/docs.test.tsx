import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chartEntries } from '../site/catalog/registry';
import {
  builtIns,
  componentExamples,
  componentMarkdown,
  componentPrompt,
  exampleCode,
} from '../site/docs/components';
import { guideMarkdown, guides, headingId } from '../site/docs/guides';
import { docsNav, searchDocs, searchIndex } from '../site/docs/nav';
import { ComponentDocPage } from '../site/pages/ComponentDocPage';
import { DocPage } from '../site/pages/DocPage';
import { SiteSettingsProvider } from '../site/state';

// The docs site is generated from the registry, the generated props and the
// guide data. These keep every page renderable and every page reachable.

const base = { themeId: 'default', languageId: 'en', datasetId: 'saas' } as const;
const navPaths = docsNav.flatMap((s) => s.links.map((l) => l.path));

describe('guides', () => {
  it.each(guides.map((g) => [g.slug, g] as const))('%s renders, is in the sidebar and copies as Markdown', (_, guide) => {
    const html = renderToString(
      <SiteSettingsProvider>
        <DocPage guide={guide} route={`/docs/${guide.slug}`} />
      </SiteSettingsProvider>,
    );
    expect(html).toContain(guide.title.replace(/&/g, '&amp;'));
    expect(navPaths).toContain(`/docs/${guide.slug}`);

    const markdown = guideMarkdown(guide);
    expect(markdown.startsWith(`# ${guide.title}`)).toBe(true);
    for (const block of guide.blocks) {
      if ('h2' in block) {
        expect(markdown).toContain(`## ${block.h2}`);
        expect(html).toContain(`id="${headingId(block)}"`);
      }
    }
  });

  it('has unique slugs and section ids', () => {
    expect(new Set(guides.map((g) => g.slug)).size).toBe(guides.length);
    for (const guide of guides) {
      const ids = guide.blocks.filter((b) => 'h2' in b).map((b) => headingId(b as { h2: string }));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('component pages', () => {
  it.each(chartEntries.map((e) => [e.id, e] as const))('%s renders every example and its props', (_, entry) => {
    const html = renderToString(
      <SiteSettingsProvider>
        <ComponentDocPage entry={entry} route={`/docs/components/${entry.id}`} />
      </SiteSettingsProvider>,
    );
    const examples = componentExamples(entry);
    expect(html).toContain(`id="props"`);
    for (const example of examples.slice(1)) expect(html).toContain(`id="${example.id}"`);
    expect(navPaths).toContain(`/docs/components/${entry.id}`);
  });

  it.each(chartEntries.map((e) => [e.id, e] as const))('%s copies as Markdown and as a prompt', (_, entry) => {
    const examples = componentExamples(entry).map((example) => ({ example, code: exampleCode(entry, example, base) }));
    const markdown = componentMarkdown(entry, examples);
    expect(markdown).toContain(`# ${entry.name}`);
    expect(markdown).toContain(`<${String(entry.exportName)} />`);
    expect(markdown).toContain('## Props');

    const prompt = componentPrompt(entry, examples[0]!.code);
    expect(prompt).toContain(examples[0]!.code);
    expect(prompt).toContain('npm install');
    expect(builtIns(entry).length).toBeGreaterThan(3);
  });
});

describe('search', () => {
  it('finds a component by its export name', () => {
    expect(searchDocs('BarChartStacked')[0]?.path).toBe('/docs/components/bar-stacked');
  });

  it('finds a guide section', () => {
    expect(searchDocs('dark mode').map((r) => r.path)).toContain('/docs/theming#dark');
  });

  it('indexes every component', () => {
    for (const entry of chartEntries) {
      expect(searchIndex.some((i) => i.path === `/docs/components/${entry.id}`)).toBe(true);
    }
  });
});

describe('presets', () => {
  it('every preset title is translated', async () => {
    const { titleId } = await import('../site/catalog/registry');
    const source = (await import('../site/catalog/translations.ts?raw')).default as string;
    for (const entry of chartEntries) {
      for (const variant of entry.variants ?? []) {
        expect(source, `${entry.id}/${variant.id}`).toContain(`'${titleId(entry, variant)}':`);
      }
    }
  });
});
