import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Layout } from '../site/components/Layout';
import { BRAND, makerLink, platformMarkdown } from '../site/config';
import { getGuide, guideMarkdown } from '../site/content/guides';
import { llmsFullTxt, llmsTxt } from '../site/content/llms';
import { pageForPath } from '../site/content/pages';

// EmKit is by Embeddable, and says so wherever a reader or a model first meets
// it: the header and footer of every page, the description in the head,
// llms.txt, the Markdown home page, the README and package.json. The way in to
// Embeddable (what EmKit leaves out) is on the Why page, in the footer and in
// llms.txt, in one wording from site/config.ts.

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

const layout = () => {
  const root = document.createElement('div');
  root.innerHTML = renderToString(<Layout route="/docs/why">x</Layout>);
  return root;
};

describe('who makes EmKit', () => {
  it('is named and linked in the header and the footer of every page', () => {
    const root = layout();
    const header = root.querySelector('header .nav__by') as HTMLAnchorElement;
    expect(header.textContent).toBe(`by ${BRAND.maker.name}`);
    expect(header.getAttribute('href')).toBe('https://embeddable.com');
    const footer = root.querySelector('footer')!;
    expect(footer.textContent).toContain(`${BRAND.name} is by ${BRAND.maker.name}, MIT licensed`);
    expect([...footer.querySelectorAll('a')].filter((a) => a.getAttribute('href') === BRAND.maker.url).length).toBeGreaterThanOrEqual(1);
  });

  it('is in the description, llms.txt, llms-full.txt and the Markdown home page', () => {
    expect(BRAND.tagline).toContain(`by ${BRAND.maker.name}`);
    expect(llmsTxt().split('\n')[2]).toContain(`> ${BRAND.name}, by ${makerLink}, is`);
    expect(llmsFullTxt().split('\n')[2]).toContain(`by ${BRAND.maker.name}`);
    const home = pageForPath('/')!.markdown();
    expect(home).toContain(`by ${BRAND.maker.name}`);
    expect(home).toContain(makerLink);
  });

  it('is in the README and package.json, with the licence and the links npm shows', () => {
    const readme = read('README.md');
    expect(readme.split('\n').slice(0, 4).join('\n')).toContain(makerLink);
    expect(readme).toContain('MIT');
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.description).toContain(BRAND.maker.name);
    expect(pkg.license).toBe('MIT');
    expect(pkg.homepage).toBe(BRAND.url);
    expect(pkg.repository.url).toContain('github.com/embeddable-hq/em-kit');
    expect(pkg.keywords).toEqual(expect.arrayContaining(['react', 'charts', 'dashboard', 'customer-facing analytics', 'embedded analytics', 'multi-tenant']));
  });
});

describe('the way in to Embeddable', () => {
  it('names what EmKit leaves out, in one wording, on the Why page, in the footer, llms.txt and the README', () => {
    for (const part of ['data layer', 'multi-tenant security', 'self-serve dashboards']) expect(BRAND.platform).toContain(part);
    const why = guideMarkdown(getGuide('why')!);
    expect(why).toContain('## If you need the data layer too');
    expect(why).toContain(platformMarkdown);
    expect(layout().querySelector('footer')!.textContent).toContain(BRAND.platform);
    expect(llmsTxt()).toContain(platformMarkdown);
    expect(read('README.md')).toContain(platformMarkdown);
  });

  it('says how EmKit relates to Remarkable Pro once per place, and never calls EmKit by that name', () => {
    expect(BRAND.relation).toContain('standalone React library');
    expect(BRAND.relation).toContain('Inside Embeddable the same components are called Remarkable Pro');
    for (const text of [guideMarkdown(getGuide('why')!), llmsTxt(), pageForPath('/')!.markdown()]) {
      expect(text).toContain(BRAND.relation);
      expect(text.match(/Remarkable Pro/g)).toHaveLength(1);
    }
  });
});
