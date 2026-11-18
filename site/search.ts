import { chartEntries } from './catalog/registry';
import { FIELD_OPTIONS_PATH, fieldOptionType, COMMON_FIELD_OPTIONS, TIME_FIELD_OPTIONS, specificFieldOptions } from './catalog/fieldOptionNotes';
import { guides, headingId } from './content/guides';
import { componentProps } from './generated/props';
import { componentPath } from './content/routes';

// The ⌘K search index and the search over it. Only the search dialog imports
// this module, and the dialog is itself loaded when it first opens (see
// components/SearchButton.tsx), so none of this is in the page that loads first.

export type SearchKind = 'Components' | 'Props' | 'Examples' | 'Guides';

export type SearchItem = {
  /** What the result is called: a page, a section, a prop, an example. */
  title: string;
  path: string;
  /** The heading the dialog lists the result under. */
  kind: SearchKind;
  /** Text matched by the search but not shown: only what the page itself says. */
  keywords: string;
  /** Shown after the title: the component or guide the result belongs to. */
  hint?: string;
  /** Props and options read as code. */
  code?: boolean;
  /** Listed before anything is typed. */
  suggested?: boolean;
};

/** The order groups take when their best matches tie. */
const kindOrder: SearchKind[] = ['Components', 'Props', 'Examples', 'Guides'];
/** The most results one group shows. */
const groupCap: Record<SearchKind, number> = { Components: 6, Props: 6, Examples: 5, Guides: 6 };

const spaced = (text: string) => text.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The text under each guide heading, so "csv" or "provider" finds the guide section that says it.
const sectionText = (blocks: (typeof guides)[number]['blocks'], from: number) => {
  const out: string[] = [];
  for (const block of blocks.slice(from + 1)) {
    if ('h2' in block) break;
    if ('md' in block) out.push(block.md.replace(/[`*_#>[\]()]/g, ' '));
  }
  const text = out.join(' ');
  // A section that opens on the export menu is what "csv", "xlsx" or "png" is looking for.
  return /^\W*export menu/i.test(text) ? `${text} csv xlsx excel png` : text;
};

// The values a type lists ("csv" | "xlsx"), not words like boolean or string that every prop has.
const literals = (type: string) => {
  const values = [...type.matchAll(/["']([\w-]+)["']/g)].map((m) => m[1]!);
  // `menuOptions` lists the export formats: that is what "export" is looking for.
  return (values.includes('csv') ? [...values, 'export', 'download'] : values).join(' ');
};

// What a visitor types for the card's export menu. The guide that explains it
// leads for these words, ahead of every prop whose type happens to list the formats.
const CARD_MENU_PATH = '/docs/card-menu';
const cardMenuWords = new Set(['export', 'csv', 'excel', 'xlsx', 'png', 'download']);

const suggestedPaths = ['/docs/quick-start', '/docs/components', '/docs/describing-your-data', '/docs/theming', '/examples', '/examples/ai-chat'];

const buildIndex = (): SearchItem[] => {
  const items: SearchItem[] = [];
  const add = (item: SearchItem) => items.push({ ...item, suggested: suggestedPaths.includes(item.path) && !item.path.includes('#') });

  for (const g of guides) {
    add({ title: g.title, path: `/docs/${g.slug}`, kind: 'Guides', keywords: g.description, hint: g.section });
    g.blocks.forEach((b, i) => {
      if ('h2' in b)
        add({ title: b.h2, path: `/docs/${g.slug}#${headingId(b)}`, kind: 'Guides', keywords: sectionText(g.blocks, i), hint: g.title });
    });
  }

  add({ title: 'All components', path: '/docs/components', kind: 'Components', keywords: 'every component list browse by type', hint: `${chartEntries.length} live previews` });
  for (const e of chartEntries) {
    const exportName = String(e.exportName);
    // Only what the component's own text says: no shared keywords, or every query would find every component.
    add({
      title: e.name,
      path: componentPath(e.id),
      kind: 'Components',
      keywords: `${exportName} ${spaced(exportName)} ${e.group} ${e.description}`,
      hint: `<${exportName} />`,
    });
    for (const v of e.variants ?? []) {
      // Variant names read "Bar chart · growth, up and down": show the preset once, the component as the hint.
      const preset = v.name.startsWith(`${e.name} · `) ? v.name.slice(e.name.length + 3) : v.name;
      add({ title: capital(preset), path: `${componentPath(e.id)}#${v.id}`, kind: 'Examples', keywords: `${e.name} ${v.description}`, hint: e.name });
    }
    const props = componentProps[exportName] ?? [];
    for (const p of props) {
      // The type's own text too, so "csv" or "png" finds `menuOptions`, whose type lists them.
      add({ title: p.name, path: `${componentPath(e.id)}#props`, kind: 'Props', keywords: `${spaced(p.name)} ${literals(p.type)}`, hint: e.name, code: true });
    }
    const seen = new Set(props.map((p) => p.name));
    for (const row of specificFieldOptions(exportName)) {
      if (seen.has(row.option.name)) continue;
      add({ title: row.option.name, path: `${componentPath(e.id)}#field-options`, kind: 'Props', keywords: `${spaced(row.option.name)} ${literals(fieldOptionType(row.option))}`, hint: `${e.name} field option`, code: true });
    }
  }
  // The options every field takes are described once, in a guide.
  for (const name of [...COMMON_FIELD_OPTIONS, ...TIME_FIELD_OPTIONS]) {
    add({ title: name, path: FIELD_OPTIONS_PATH, kind: 'Props', keywords: spaced(name), hint: 'Field option, every component', code: true });
  }

  add({ title: 'Analytics dashboard', path: '/examples', kind: 'Examples', keywords: 'dashboard example cross filter app', hint: 'A complete app' });
  add({ title: 'AI chat assistant', path: '/examples/ai-chat', kind: 'Examples', keywords: 'chat example llm model spec', hint: 'A complete app' });
  return items;
};

// Built on first use (the first time the dialog opens), not when the page loads.
let built: SearchItem[] | undefined;
export const searchIndex = (): SearchItem[] => (built ??= buildIndex());

const scoreItem = (item: SearchItem, words: string[], whole: string): number | null => {
  const title = item.title.toLowerCase();
  const keywords = item.keywords.toLowerCase();
  const haystack = `${title} ${keywords}`;
  if (!words.every((w) => haystack.includes(w))) return null;
  const name = squash(item.title);
  let score = 0;
  // Typing a whole name, in any case or spacing ("xAxisMaxItems", "x axis max items"), puts that item first.
  if (whole && name === whole) score += 10;
  else if (whole.length > 2 && name.startsWith(whole)) score += 4;
  for (const w of words) {
    if (title.startsWith(w)) score += 3;
    else if (title.includes(w)) score += 2;
    else if (keywords.includes(w)) score += 0.5;
    else score += 0.25;
  }
  return score;
};

// Every word of the query must appear somewhere in the item. Results come
// back in groups, the group holding the best match first, best match first
// within it, each group cut to a few.
export const searchDocs = (query: string): SearchItem[] => {
  const index = searchIndex();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return kindOrder.flatMap((kind) => index.filter((i) => i.suggested && i.kind === kind));
  const whole = squash(query);
  const scored = index
    .map((item) => ({ item, score: scoreItem(item, words, whole) }))
    .filter((x): x is { item: SearchItem; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);
  // The card menu guide comes first for the words that name its export formats.
  if (words.length === 1 && cardMenuWords.has(words[0]!)) {
    const menu = index.find((i) => i.path === CARD_MENU_PATH);
    const top = scored[0]?.score ?? 0;
    if (menu) {
      const at = scored.findIndex((x) => x.item === menu);
      if (at >= 0) scored.splice(at, 1);
      scored.unshift({ item: menu, score: top + 1 });
    }
  }
  const best = (kind: SearchKind) => scored.find((x) => x.item.kind === kind)?.score ?? -1;
  const kinds = [...kindOrder].sort((a, b) => best(b) - best(a) || kindOrder.indexOf(a) - kindOrder.indexOf(b));
  // A prop that every component has would fill its group when only its type text matches: show it twice.
  const titleMatches = (item: SearchItem) => words.some((w) => item.title.toLowerCase().includes(w));
  return kinds.flatMap((kind) => {
    const seenTitles = new Map<string, number>();
    return scored
      .filter((x) => x.item.kind === kind)
      .filter(({ item }) => {
        if (titleMatches(item)) return true;
        const n = (seenTitles.get(item.title) ?? 0) + 1;
        seenTitles.set(item.title, n);
        return n <= 2;
      })
      .slice(0, groupCap[kind])
      .map((x) => x.item);
  });
};
