import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMON_FIELD_OPTIONS,
  fieldOptionNote,
  FIELD_OPTIONS_PATH,
  hasFieldOptionNote,
  specificFieldOptions,
} from '../site/catalog/fieldOptionNotes';
import { chartEntries, chartGroups } from '../site/catalog/registry';
import { CodeBlock } from '../site/components/CodeBlock';
import { installMarkdown } from '../site/components/InstallCommand';
import { BRAND } from '../site/config';
import {
  componentExamples,
  componentPageMarkdown,
  componentPrompt,
  componentsIndexMarkdown,
  exampleCode,
  exampleView,
  keyboardRows,
  propDescription,
  propsOf,
  requiredProps,
  siblingNote,
  takesResults,
  writtenExamplesOf,
} from '../site/content/components';
import { componentPath, playgroundPath } from '../site/content/routes';
import { componentFieldOptions } from '../site/generated/props';
import { ChartPage } from '../site/pages/ChartPage';
import { ComponentDocPage } from '../site/pages/ComponentDocPage';
import { ComponentsIndex } from '../site/pages/ComponentsIndex';
import { SiteSettingsProvider } from '../site/state';

// Component pages, the components index and the playground: one skeleton on
// every page, nothing repeated between pages, and a Markdown twin an agent can
// use on its own. See site/STANDARDS.md, categories B, D, E and F.

const base = { themeId: 'default', languageId: 'en', datasetId: 'saas' } as const;
const each = chartEntries.map((e) => [e.id, e] as const);

const render = (node: React.ReactNode) => renderToString(<SiteSettingsProvider>{node}</SiteSettingsProvider>);

const dom = (html: string) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};

const count = (text: string, part: string) => text.split(part).length - 1;

// What a reader reads as prose: not code, tables, the charts themselves,
// navigation or buttons.
const proseWords = (article: Element) => {
  const copy = article.cloneNode(true) as Element;
  copy
    .querySelectorAll('pre, table, nav, button, summary, .chart-canvas, .code-block__bar, [role="radiogroup"], select')
    .forEach((el) => el.remove());
  return (copy.textContent ?? '').split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
};

describe('component page', () => {
  it.each(each)('%s has the skeleton, in order, and nothing else', (_, entry) => {
    const html = render(<ComponentDocPage entry={entry} route={componentPath(entry.id)} />);
    const article = dom(html).querySelector('.component-page')!;

    const sections = [...article.children].map((el) => el.getAttribute('data-section'));
    expect(sections).toEqual(['header', 'preview', 'usage', 'examples', 'props']);
    expect([...article.querySelectorAll(':scope > section > h2')].map((h) => h.id)).toEqual(['preview', 'usage', 'examples', 'props']);

    // Header: title, one-line purpose, each action once.
    const header = article.querySelector('[data-section="header"]')!;
    expect(header.querySelector('h1')!.textContent).toBe(entry.name);
    expect(header.querySelector('.lede')!.textContent!.split(/[.!?]\s/).length).toBe(1);
    for (const label of ['Copy page as Markdown', 'Copy prompt', 'Open in playground']) expect(count(html, label)).toBe(1);
    expect(header.querySelector(`a[href="${playgroundPath(entry.id)}"]`)).not.toBeNull();

    // Preview: the states are a switch on the chart, not sections of their own.
    const states = [...article.querySelectorAll('[aria-label="Preview state"] [role="radio"]')].map((b) => b.textContent);
    // A control that takes no rows (a date picker, a text field) has no states to switch between.
    expect(states).toEqual(takesResults(entry) ? ['Data', 'Loading', 'Empty', 'Error'] : []);
    for (const id of ['loading', 'empty', 'error']) expect(article.querySelector(`#${id}`)).toBeNull();

    // Usage: the default example's whole module, on the page without a click,
    // then one setup line: the install command and a link to the quick start.
    // Setup prose lives once, on the quick start (STANDARDS.md, settled conflicts).
    const usage = article.querySelector('[data-section="usage"]')!;
    const usageCode = usage.querySelector(':scope > .code-block pre')!;
    expect(usageCode.textContent).toBe(exampleCode(entry, componentExamples(entry)[0]!, base));
    expect(usageCode.closest('[hidden], details')).toBeNull();
    expect(usage.querySelectorAll('.install-command, .setup-table, details').length).toBe(0);
    const setup = usage.querySelector('.usage-setup')!;
    expect(setup.textContent).toContain(`npm install ${BRAND.packageName}`);
    expect(setup.querySelector('a[href="/docs/quick-start"]')).not.toBeNull();

    // Examples: a short title, one sentence, a live preview and its code with a copy button.
    const examples = componentExamples(entry).slice(1);
    const allBlocks = [...article.querySelectorAll('[data-section="examples"] .component-example')];
    expect(allBlocks.length).toBe(examples.length + writtenExamplesOf(entry).length);
    // The generated examples first; a hand-written one after them is checked below.
    const blocks = allBlocks.slice(0, examples.length);
    expect(blocks.length).toBeGreaterThan(0);
    allBlocks.slice(examples.length).forEach((block, i) => {
      const written = writtenExamplesOf(entry)[i]!;
      expect(block.querySelector('h3')!.id).toBe(written.id);
      expect(block.querySelectorAll('p').length).toBe(1);
      expect(block.querySelector('.chart-canvas')).not.toBeNull();
      expect(block.querySelector('pre')!.textContent).toBe(written.code);
      expect(block.querySelectorAll('button[aria-label="Copy code"]').length).toBe(1);
    });
    blocks.forEach((block, i) => {
      const example = examples[i]!;
      expect(block.querySelector('h3')!.id).toBe(example.id);
      expect(example.name.split(' ').length).toBeLessThanOrEqual(6);
      expect(example.name).not.toContain(entry.name);
      expect(block.querySelectorAll('p').length).toBe(1);
      expect(block.querySelector('.chart-canvas')).not.toBeNull();
      expect(block.querySelector('pre')!.textContent).toContain(`<${String(entry.exportName)}`);
      expect(block.querySelectorAll('button[aria-label="Copy code"]').length).toBe(1);
      // Shown: an excerpt. In the HTML, shut but there for an agent: the whole module.
      const view = exampleView(entry, example, base);
      const full = block.querySelector('details.code-block__full')!;
      expect(full.hasAttribute('open')).toBe(false);
      expect(full.querySelector('summary')!.textContent).toMatch(/^Show full code \(\d+ lines\)$/);
      expect(full.querySelector('pre')!.textContent).toBe(exampleCode(entry, example, base));
      expect(block.querySelector('pre.code-block__excerpt')!.textContent).toBe(view.excerpt!.code);
      expect(block.querySelectorAll('pre.code-block__excerpt .sh__line--marked').length).toBe(view.excerpt!.marked.length);
    });

    // Props: a table of name, type, default and description, required first.
    const props = article.querySelector('[data-section="props"]')!;
    const table = props.querySelector('table')!;
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Prop', 'Type', 'Default', 'Description']);
    const rows = [...table.querySelectorAll('tbody tr')];
    expect(rows.length).toBe(propsOf(entry).length);
    const required = rows.map((row) => row.textContent!.includes('required'));
    expect(required.lastIndexOf(true)).toBe(required.filter(Boolean).length - 1);
    for (const row of rows) expect(row.querySelector('td:last-child')!.textContent!.length).toBeGreaterThan(10);
    // A default is a value or blank (unset), never a placeholder; the legend says which.
    const defaultOf = (name: string) =>
      rows.find((row) => row.querySelector('th code')!.textContent === name)?.querySelector('td:nth-child(3)')!.textContent;
    for (const row of rows) expect(row.querySelector('td:nth-child(3)')!.textContent).not.toMatch(/^[–-]$/);
    if (propsOf(entry).some((p) => p.name === 'hideMenu')) expect(defaultOf('hideMenu')).toBe('false');
    if (propsOf(entry).some((p) => p.name === 'reverseTrendDirection')) expect(defaultOf('reverseTrendDirection')).toBe('');
    expect(props.querySelector('.api-table__legend')!.textContent).toContain('unset');
    // One link to the accessibility guide: in the keyboard section where the page has one.
    expect(props.querySelectorAll('a[href^="/docs/accessibility"]').length).toBe(1);
    expect(Boolean(props.querySelector('#keyboard'))).toBe(Boolean(keyboardRows(entry)));
    if (keyboardRows(entry)) {
      const keys = [...props.querySelectorAll('.keyboard-table tbody tr')];
      expect(keys.length).toBe(keyboardRows(entry)!.length);
      expect(props.querySelector('#keyboard ~ p a[href="/docs/accessibility#keyboard"]')).not.toBeNull();
    }
    expect(props.querySelectorAll(`a[href="${FIELD_OPTIONS_PATH}"]`).length).toBe(1);

    // No boilerplate beyond the skeleton, and none of the sentences every page used to repeat.
    for (const gone of [
      'What it does for you',
      'Installation',
      'Each example is live',
      'covers the provider',
      'Generated from the component’s types',
      'Every field takes the',
    ]) {
      expect(article.textContent).not.toContain(gone);
    }
    // The install command is one inline mention in the usage line, not a section.
    expect(article.textContent!.split('npm install').length - 1).toBe(1);
    expect(proseWords(article)).toBeLessThan(250);
  });

  it.each(each)('%s lists only its own field options', (_, entry) => {
    const html = render(<ComponentDocPage entry={entry} route={componentPath(entry.id)} />);
    const section = dom(html).querySelector('#field-options')!.parentElement!;
    const listed = [...section.querySelectorAll('table')].flatMap((table) =>
      [...table.querySelectorAll('tbody th')].map((th) => th.textContent),
    );
    const own = specificFieldOptions(String(entry.exportName)).map((row) => row.option.name);
    for (const name of own) expect(listed).toContain(name);
    // The options every field takes are in the guide, not repeated here.
    for (const name of COMMON_FIELD_OPTIONS) expect(listed).not.toContain(name);
  });
});

describe('keyboard', () => {
  it('has its own table on the table, pivot table and heat map pages only', () => {
    expect(chartEntries.filter((e) => keyboardRows(e)).map((e) => String(e.exportName))).toEqual([
      'TablePaginated',
      'TableScrollable',
      'PivotTable',
      'HeatMap',
    ]);
  });
});

describe('example code block', () => {
  it('copies the whole module, whichever view is open', async () => {
    const entry = chartEntries.find((e) => e.id === 'bar')!;
    const example = componentExamples(entry)[1]!;
    const view = exampleView(entry, example, base);
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<CodeBlock code={view.code} marked={view.marked} excerpt={view.excerpt} />));
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Copy code"]')!.click());
    expect(writeText).toHaveBeenCalledWith(view.code);
    // Opening the full file relabels the toggle; the full module was in the DOM all along.
    const details = container.querySelector('details')!;
    act(() => {
      details.open = true;
      details.dispatchEvent(new Event('toggle'));
    });
    expect(container.querySelector('summary')!.textContent).toBe('Hide full code');
    act(() => root.unmount());
    container.remove();
  });
});

describe('props reference', () => {
  it.each(each)('%s describes every prop, requires results and types the menu', (_, entry) => {
    const props = propsOf(entry);
    for (const prop of props) {
      expect(propDescription(prop, entry), `${String(entry.exportName)}.${prop.name}`).not.toBe('');
      expect(propDescription(prop, entry)).not.toMatch(/Field options below|—/);
      expect(prop.type).not.toContain('unknown[]');
    }
    if (takesResults(entry)) expect(requiredProps(entry)).toContain('results');
    expect(props.findIndex((p) => !p.required)).toBe(requiredProps(entry).length);
  });

  it('describes every field option in plain words', () => {
    for (const fields of Object.values(componentFieldOptions)) {
      for (const field of Object.values(fields)) {
        for (const option of field.inputs) {
          expect(hasFieldOptionNote(option.name), option.name).toBe(true);
          const note = fieldOptionNote(option);
          expect(note.split(' ').length, option.name).toBeGreaterThan(3);
          expect(note).not.toMatch(/input above|variable|dashboards/i);
        }
      }
    }
  });
});

describe('component Markdown', () => {
  it.each(each)('%s is self-contained', (_, entry) => {
    const markdown = componentPageMarkdown(entry);
    const name = String(entry.exportName);

    expect(markdown.startsWith(`# ${entry.name}\n`)).toBe(true);
    const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual([
      'Install',
      'Usage',
      ...(takesResults(entry) ? ['States'] : []),
      'Examples',
      'Props',
      'Field options',
      ...(keyboardRows(entry) ? ['Keyboard'] : []),
    ]);

    // Install, for every package manager, with the provider and the peer dependency.
    expect(markdown).toContain(installMarkdown());
    expect(markdown).toContain('<ChartsProvider>');
    expect(markdown).toContain('`react` and `react-dom` 19.1.1 or later are the only peer dependencies');

    // A complete usage example and every example's code.
    const examples = componentExamples(entry);
    expect(count(markdown, '```tsx')).toBe(examples.length + writtenExamplesOf(entry).length);
    for (const written of writtenExamplesOf(entry)) expect(markdown).toContain(written.code);
    expect(markdown).toContain(exampleCode(entry, examples[0]!, base));
    for (const example of examples.slice(1)) expect(markdown).toContain(`### ${example.name}`);

    // Props: type, required, default and description, required props first.
    expect(markdown).toContain('| Prop | Type | Required | Default | Description |');
    const rows = markdown.split('\n').filter((line) => / \| (yes|no) \| /.test(line));
    expect(rows.length).toBe(propsOf(entry).length);
    const required = rows.map((row) => row.includes(' | yes | '));
    expect(required.lastIndexOf(true)).toBe(required.filter(Boolean).length - 1);
    for (const prop of requiredProps(entry)) expect(markdown).toContain(`\`${prop}\``);

    // Field options: this component's own, and a link for the ones every field takes.
    for (const { option } of specificFieldOptions(name)) expect(markdown).toContain(`| \`${option.name}\` |`);
    expect(markdown).toContain(`(${FIELD_OPTIONS_PATH.replace('#', '.md#')})`);

    // Where the page lives.
    expect(markdown).toContain(`${BRAND.url}${componentPath(entry.id)}`);

    // Outside the code samples, nothing a template left behind. The type
    // shapes say `undefined` as code, which is what the types declare.
    const prose = markdown.replace(/```tsx[\s\S]*?```/g, '');
    expect(prose.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '')).not.toContain('undefined');
    expect(prose).not.toContain('…');
    expect(prose).not.toContain('[object');

    // Nothing that points at a section the Markdown does not have.
    expect(markdown).not.toContain('What it does for you');
    expect(markdown).not.toMatch(/Field options (below|on the chart page)/i);
    expect(markdown).not.toMatch(/\bgallery\b/i);
    // "Field options", as the name of a section, is only ever this page's own or a link to the guide.
    const rest = markdown.replace(/^## Field options$/m, '').replace(/\[Field options\]\([^)]+\)/g, '');
    expect(rest).not.toContain('Field options');
  });

  it('says where a family names its fields differently', () => {
    const note = (id: string) => siblingNote(chartEntries.find((e) => e.id === id)!);
    expect(note('bar')).toContain('`BarChart` takes `dimension` + `measures`');
    expect(note('bar')).toContain('`BarChartStacked` and `BarChartGrouped` take `xAxis` + `groupBy` + `measure`');
    expect(note('bar-stacked')).toContain('`BarChart`');
    expect(componentPageMarkdown(chartEntries.find((e) => e.id === 'bar-stacked')!)).toContain(note('bar-stacked'));
    // Nothing to say where the whole family agrees.
    expect(note('kpi')).toBe('');
    expect(note('funnel')).toBe('');
  });
});

describe('component prompt', () => {
  it.each(each)('%s agrees with the code it carries', (_, entry) => {
    const code = exampleCode(entry, componentExamples(entry)[0]!, base);
    const prompt = componentPrompt(entry, code);

    expect(prompt).toContain(code);
    expect(prompt).toContain(`npm install ${BRAND.packageName}`);
    expect(prompt).toContain(`pnpm add ${BRAND.packageName}`);
    expect(prompt).toContain(`${BRAND.url}${componentPath(entry.id)}.md`);
    for (const prop of requiredProps(entry)) expect(prompt).toContain(`\`${prop}\``);

    // One instruction about the provider, matching whether the code has it.
    expect(prompt).not.toContain('Skip this if it is already there');
    expect(count(prompt.replace(code, ''), 'ChartsProvider')).toBe(1);
    expect(prompt.includes('The code includes `<ChartsProvider>`')).toBe(code.includes('<ChartsProvider'));
    // And one about height, matching whether the code has a sized wrapper. A control sizes itself.
    if (entry.group === 'Controls') {
      expect(prompt).toContain('needs no height');
      return;
    }
    expect(prompt.includes('Keep the wrapper’s height')).toBe(/height/i.test(code));
    expect(prompt.includes('render it inside an element with a height')).toBe(!/height/i.test(code));
  });

  it('words the steps from the code, either way', () => {
    const entry = chartEntries[0]!;
    const bare = componentPrompt(entry, '<KpiNumber measure={revenue} results={results(rows)} />');
    expect(bare).toContain('Add it if my app has none');
    expect(bare).toContain('render it inside an element with a height');
    const complete = componentPrompt(
      entry,
      '<ChartsProvider><div style={{ height: 160 }}><KpiNumber measure={revenue} results={results(rows)} /></div></ChartsProvider>',
    );
    expect(complete).toContain('The code includes `<ChartsProvider>`');
    expect(complete).toContain('Keep the wrapper’s height');
    expect(complete).not.toContain('Add it if my app has none');
  });
});

describe('components index', () => {
  const html = render(<ComponentsIndex route="/docs/components" />);
  const page = dom(html).querySelector('.components-index')!;

  it('shows every component once, grouped by type, with counts that add up', () => {
    const cards = [...page.querySelectorAll('.index-card')];
    expect(cards.length).toBe(chartEntries.length);
    expect(chartEntries.length).toBe(32);

    const groups = [...page.querySelectorAll('.index-group')];
    expect(groups.map((g) => g.getAttribute('data-group'))).toEqual([...chartGroups]);
    const number = (el: Element) => Number.parseInt(el.textContent!, 10);
    const counts = groups.map((g) => number(g.querySelector('.index-group__count')!));
    expect(counts).toEqual(groups.map((g) => g.querySelectorAll('.index-card').length));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(chartEntries.length);

    // The jump links carry the same counts and point at the groups.
    const links = [...page.querySelectorAll('.index-nav a')];
    expect(links.map((a) => number(a.querySelector('.index-nav__count')!))).toEqual(counts);
    for (const link of links) expect(page.querySelector(`#${link.getAttribute('href')!.split('#')[1]}`)).not.toBeNull();
  });

  it('gives each card a preview, a link to its docs, its export name and Copy code', () => {
    for (const entry of chartEntries) {
      const link = page.querySelector(`.index-card h3 a[href="${componentPath(entry.id)}"]`)!;
      expect(link.textContent).toBe(entry.name);
      const card = link.closest('.index-card')!;
      expect(card.querySelector('.chart-canvas')).not.toBeNull();
      expect(card.querySelector('code')!.textContent).toBe(String(entry.exportName));
      expect([...card.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['View code', 'Copy code']);
    }
    // One page for this job: no link to a second gallery.
    expect(page.innerHTML).not.toContain('href="/charts');
    expect(page.innerHTML).not.toMatch(/gallery/i);
  });

  it('copies as Markdown with a link per component', () => {
    const markdown = componentsIndexMarkdown();
    for (const entry of chartEntries) expect(markdown).toContain(`(${componentPath(entry.id)}.md)`);
    for (const group of chartGroups) {
      expect(markdown).toContain(`## ${group} (${chartEntries.filter((e) => e.group === group).length})`);
    }
  });
});

describe('playground', () => {
  it.each(each)('%s has its own heading, a way back, and no copy of the docs', (_, entry) => {
    const page = dom(render(<ChartPage entry={entry} />));
    expect([...page.querySelectorAll('.page__head h1')].map((h) => h.textContent)).toEqual([`${entry.name} playground`]);
    expect(page.querySelector(`.crumbs a[href="${componentPath(entry.id)}"]`)!.textContent).toBe(entry.name);
    expect(page.querySelector('.crumbs')!.textContent).toMatch(/^Components · /);

    // Kept: live prop editing, the data-state switch and the event log.
    expect(page.querySelector('.controls')).not.toBeNull();
    expect([...page.querySelectorAll('[aria-label="Data state"] [role="radio"]')].length).toBe(4);
    expect(page.querySelector('.events')).not.toBeNull();

    // Gone: what the docs page already says.
    expect(page.querySelector('.lede')).toBeNull();
    expect(page.querySelector('table')?.closest('.field-options') ?? null).toBeNull();
    expect(page.textContent).not.toContain(entry.description);
  });
});
