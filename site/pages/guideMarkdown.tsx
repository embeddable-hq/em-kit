import { createElement, type Key, type ReactNode } from 'react';

// The prose in guides is Markdown of a small kind: paragraphs, lists, tables
// and quotes, with links, bold and inline code. lightMarkdown() draws that
// kind into exactly the HTML components/Markdown.tsx draws (tests/pageWeight
// compares the two on every block of every guide), without a Markdown parser:
// the parser and its GFM extensions are about 45 KB of gzipped JavaScript,
// more than the rest of a guide's page. For anything else it returns
// undefined, and the block is drawn by components/Markdown.tsx, which loads
// for the guides that need it (see guideChunks.ts).

const cache = new Map<string, ReactNode[] | null>();

/** The block as React elements, or undefined if it uses Markdown this does not draw. */
export const lightMarkdown = (md: string): ReactNode[] | undefined => {
  if (!cache.has(md)) cache.set(md, blocks(md, false) ?? null);
  return cache.get(md) ?? undefined;
};

// ---- Inline: text, `code`, **bold** and [links](/path) ---------------------

// Markdown this does not draw, where it starts: escapes, HTML and autolinks,
// emphasis, strikethrough, email and bare-URL autolinks, entities, images.
const UNSUPPORTED = /[\\<_~@]|!\[|&#?\w+;|www\.|[a-z]+:\/\//iy;
const SAFE_HREF = /^(\/|#|https?:\/\/)[^\s()<>\\]*$/;
const PUNCTUATION = /[!-/:-@[-`{-~ -⁯⸀-⹿]/;

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);
const isPunct = (c: string | undefined) => c !== undefined && PUNCTUATION.test(c);

// CommonMark's flanking rules for `**`: it opens when the next character is
// not a space and, if that is punctuation, the one before is a space or
// punctuation. Closing is the mirror image.
const opensBold = (before: string | undefined, after: string | undefined) =>
  !isSpace(after) && (!isPunct(after) || isSpace(before) || isPunct(before));
const closesBold = (before: string | undefined, after: string | undefined) =>
  !isSpace(before) && (!isPunct(before) || isSpace(after) || isPunct(after));

const inline = (src: string, inLink = false): ReactNode[] | undefined => {
  const out: ReactNode[] = [];
  let text = '';
  const push = (node: ReactNode) => {
    if (text) out.push(text);
    text = '';
    out.push(node);
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '`') {
      const end = src.indexOf('`', i + 1);
      if (src[i + 1] === '`' || end < 0 || src[end + 1] === '`') return undefined;
      let code = src.slice(i + 1, end).replace(/\n/g, ' ');
      if (code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1);
      push(createElement('code', { key: out.length }, code));
      i = end + 1;
      continue;
    }
    UNSUPPORTED.lastIndex = i;
    if (UNSUPPORTED.test(src) || c === ']') return undefined;
    if (c === '[') {
      const close = src.indexOf('](', i);
      const end = close < 0 ? -1 : src.indexOf(')', close);
      if (inLink || end < 0) return undefined;
      const label = src.slice(i + 1, close);
      const href = src.slice(close + 2, end);
      const children = !/[[\]]/.test(label) && SAFE_HREF.test(href) ? inline(label, true) : undefined;
      if (!label || !children) return undefined;
      push(createElement('a', { key: out.length, href }, ...children));
      i = end + 1;
      continue;
    }
    if (c === '*') {
      const end = src.indexOf('**', i + 2);
      if (src[i + 1] !== '*' || src[i + 2] === '*' || !opensBold(src[i - 1], src[i + 2])) return undefined;
      if (end < 0 || src[end + 2] === '*' || !closesBold(src[end - 1], src[end + 2])) return undefined;
      const children = inline(src.slice(i + 2, end), inLink);
      if (!children) return undefined;
      push(createElement('strong', { key: out.length }, ...children));
      i = end + 2;
      continue;
    }
    text += c;
    i++;
  }
  if (text) out.push(text);
  return out;
};

// ---- Blocks: paragraphs, lists, tables, quotes ------------------------------

const BULLET = /^- (.*)$/;
const NUMBERED = /^(\d+)\. (.*)$/;

// A line of a paragraph (or a list item's text) that could start or end some
// other block: a heading, a fence, HTML, a list, a rule or setext underline,
// a table row or its delimiter row, a quote, indented code.
const startsBlock = (line: string) =>
  /^(\s|#|```|~~~|<|[-+*](\s|$)|\d+[.)](\s|$)|\||>)/.test(line) || /^[-*_=\s]+$/.test(line) || /^[\s|:-]*-[\s|:-]*$/.test(line);

const paragraph = (lines: string[], key: Key) => {
  const children = lines.some(startsBlock) ? undefined : inline(lines.join('\n'));
  return children && createElement('p', { key }, ...children);
};

// A block element's children each on a line of their own, as Markdown's HTML has them.
const onLines = (children: ReactNode[]) => ['\n', ...children.flatMap((child) => [child, '\n'])];

const list = (lines: string[], tag: 'ul' | 'ol', key: Key) => {
  const items: ReactNode[] = [];
  for (const [n, line] of lines.entries()) {
    const match = line.match(tag === 'ul' ? BULLET : NUMBERED);
    const content = match?.[match.length - 1] ?? '';
    // A numbered list that does not start at 1 has a `start` attribute: not drawn here.
    if (!match || !content || startsBlock(content) || (tag === 'ol' && n === 0 && match[1] !== '1')) return undefined;
    const children = inline(content);
    if (!children) return undefined;
    items.push(createElement('li', { key: n }, ...children));
  }
  return createElement(tag, { key, ...(tag === 'ul' && { className: 'doc-list' }) }, ...onLines(items));
};

const cells = (line: string) => line.slice(1, -1).split('|').map((cell) => cell.trim());

const alignment = (rule: string) => {
  if (/^:-+:$/.test(rule)) return 'center';
  if (/^:-+$/.test(rule)) return 'left';
  if (/^-+:$/.test(rule)) return 'right';
  return /^-+$/.test(rule) ? null : undefined;
};

const table = (lines: string[], key: Key) => {
  if (lines.length < 3 || lines.some((line) => !/^\|.*\|$/.test(line))) return undefined;
  const [head, rule, ...rows] = lines.map(cells) as [string[], string[], ...string[][]];
  const aligns = rule.map(alignment);
  if (aligns.includes(undefined) || [head, ...rows].some((row) => row.length !== aligns.length)) return undefined;
  const row = (values: string[], tag: 'th' | 'td', rowKey: number) => {
    const contents = values.map((value) => inline(value));
    if (contents.some((content) => !content)) return undefined;
    return createElement(
      'tr',
      { key: rowKey },
      ...contents.map((content, i) => createElement(tag, { key: i, ...(aligns[i] && { style: { textAlign: aligns[i] } }) }, ...content!)),
    );
  };
  const header = row(head, 'th', 0);
  const body = rows.map((values, i) => row(values, 'td', i));
  if (!header || body.some((tr) => !tr)) return undefined;
  return createElement(
    'div',
    { key, className: 'doc-table-scroll' },
    createElement('table', { className: 'doc-table' }, createElement('thead', null, header), createElement('tbody', null, ...body)),
  );
};

const quote = (lines: string[], key: Key) => {
  if (lines.some((line) => !/^>( |$)/.test(line))) return undefined;
  const inner = blocks(lines.map((line) => line.replace(/^> ?/, '')).join('\n'), true);
  return inner && createElement('div', { key, className: 'callout' }, ...onLines(inner.filter((node) => node !== '\n')));
};

const kind = (lines: string[]) => {
  const first = lines[0]!;
  if (BULLET.test(first)) return 'ul';
  if (NUMBERED.test(first)) return 'ol';
  if (first.startsWith('|')) return 'table';
  if (first.startsWith('>')) return 'quote';
  return 'paragraph';
};

// Blocks are separated by blank lines, and each is one kind throughout. Two
// lists of the same kind with a blank line between are one loose list in
// Markdown, each item a paragraph: not drawn here, nor is a quote in a quote.
function blocks(md: string, inQuote: boolean): ReactNode[] | undefined {
  const lines = md.split('\n');
  if (!md.trim() || lines.some((line) => /[ \t]$/.test(line) || line.includes('\t'))) return undefined;
  const groups = md.split(/\n\n/).map((group) => group.split('\n'));
  if (groups.some((group) => group.some((line) => !line))) return undefined;
  const out: ReactNode[] = [];
  for (const [n, group] of groups.entries()) {
    const type = kind(group);
    if (n > 0 && (type === 'ul' || type === 'ol') && type === kind(groups[n - 1]!)) return undefined;
    const element =
      type === 'ul' || type === 'ol'
        ? list(group, type, n)
        : type === 'table'
          ? table(group, n)
          : type === 'quote'
            ? !inQuote && quote(group, n)
            : paragraph(group, n);
    if (!element) return undefined;
    if (n > 0) out.push('\n');
    out.push(element);
  }
  return out;
}
