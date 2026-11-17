// A small printer for the code the site generates, so no example needs a
// sideways scroll. It breaks a line the way Prettier would at 80 columns: the
// last bracket group on the line opens, one item per line, and a call whose
// last argument is an object or an array hugs it (`dimension({`). It knows
// only brackets, commas, strings and comments, which is all the generated
// expressions use. tests/examples.test.ts holds every example to MAX_WIDTH.

/** The width code is printed to. */
export const WIDTH = 80;

/** No generated line is wider than this, whatever it holds. */
export const MAX_WIDTH = 90;

type Open = '(' | '[' | '{';
type Group = { open: Open; items: Seq[] };
type Node = string | Group;
type Seq = Node[];

const CLOSE: Record<Open, string> = { '(': ')', '[': ']', '{': '}' };

const trimSeq = (seq: Seq): Seq => {
  const out = [...seq];
  if (typeof out[0] === 'string') out[0] = out[0].trimStart();
  const last = out.length - 1;
  if (typeof out[last] === 'string') out[last] = (out[last] as string).trimEnd();
  return out.filter((node) => node !== '');
};

/** Text and bracket groups, each group split at its own top-level commas. */
const parse = (code: string): Seq => {
  let i = 0;
  const read = (closer?: string): Seq[] => {
    const items: Seq[] = [];
    let current: Seq = [];
    let text = '';
    const flush = () => {
      if (text) current.push(text);
      text = '';
    };
    while (i < code.length) {
      const ch = code[i]!;
      if (ch === "'" || ch === '"' || ch === '`') {
        let j = i + 1;
        while (j < code.length && code[j] !== ch) j += code[j] === '\\' ? 2 : 1;
        text += code.slice(i, j + 1);
        i = j + 1;
      } else if (ch === '/' && code[i + 1] === '/') {
        text += code.slice(i);
        i = code.length;
      } else if (ch === '(' || ch === '[' || ch === '{') {
        flush();
        i++;
        current.push({ open: ch, items: read(CLOSE[ch]) });
      } else if (closer && ch === closer) {
        i++;
        flush();
        items.push(current);
        return items.map(trimSeq).filter((item, n, all) => item.length || n < all.length - 1);
      } else if (closer && ch === ',') {
        flush();
        items.push(current);
        current = [];
        i++;
      } else {
        text += ch;
        i++;
      }
    }
    flush();
    items.push(current);
    return items.map(trimSeq);
  };
  return read()[0] ?? [];
};

const flatGroup = (group: Group): string => {
  const items = group.items.map(flatSeq);
  if (!items.length) return `${group.open}${CLOSE[group.open]}`;
  return group.open === '{' ? `{ ${items.join(', ')} }` : `${group.open}${items.join(', ')}${CLOSE[group.open]}`;
};

const flatSeq = (seq: Seq): string => seq.map((node) => (typeof node === 'string' ? node : flatGroup(node))).join('');

const isGroup = (node: Node | undefined): node is Group => typeof node === 'object';

/** A group opened over several lines, its items one per line at `indent + 2`. */
const broken = (group: Group, indent: number, lead: number, tail: number, width: number): string => {
  if (!group.items.length) return flatGroup(group);
  // A call hugs a last argument that is an object or an array: `fn(a, {`.
  const last = group.items[group.items.length - 1]!;
  if (group.open === '(' && last.length === 1 && isGroup(last[0]) && last[0].open !== '(') {
    const head = group.items.slice(0, -1).map((item) => `${flatSeq(item)}, `);
    const opening = `(${head.join('')}`;
    if (lead + opening.length + 1 <= width) {
      return `${opening}${broken(last[0], indent, lead + opening.length, tail + 1, width)})`;
    }
  }
  const pad = ' '.repeat(indent + 2);
  const lines = group.items.map((item) => `${pad}${fit(item, indent + 2, indent + 2, 1, width)},`);
  return `${group.open}\n${lines.join('\n')}\n${' '.repeat(indent)}${CLOSE[group.open]}`;
};

/** `seq` on one line if it fits after `lead` columns with `tail` to follow, else its last group broken. */
const fit = (seq: Seq, indent: number, lead: number, tail: number, width: number): string => {
  const flat = flatSeq(seq);
  if (lead + flat.length + tail <= width) return flat;
  let k = seq.length - 1;
  while (k >= 0 && !isGroup(seq[k])) k--;
  if (k < 0) return flat;
  const before = flatSeq(seq.slice(0, k));
  const after = flatSeq(seq.slice(k + 1));
  return before + broken(seq[k] as Group, indent, lead + before.length, after.length + tail, width) + after;
};

/** An expression as it reads after `lead` columns on a line indented by `indent`. */
export const formatExpression = (code: string, indent: number, lead = indent, tail = 0, width = WIDTH) =>
  fit(parse(code), indent, lead, tail, width);

/**
 * An expression that must open on the line it starts, as an attribute's value
 * does: a lone array or object hugs the brace before it (`measures={[`).
 */
export const formatHugged = (code: string, indent: number, lead: number, tail: number, width = WIDTH) => {
  const seq = parse(code);
  const flat = flatSeq(seq);
  if (lead + flat.length + tail <= width) return flat;
  return seq.length === 1 && isGroup(seq[0]) ? broken(seq[0], indent, lead, tail, width) : fit(seq, indent, lead, tail, width);
};

/** A lone object or array opened over several lines whatever its length, its items fitted as usual. */
export const formatOpen = (code: string, indent: number, width = WIDTH) => {
  const seq = parse(code);
  return seq.length === 1 && isGroup(seq[0]) ? broken(seq[0], indent, indent, 0, width) : fit(seq, indent, indent, 0, width);
};

/** `// text`, wrapped at word breaks to fit the width. */
export const commentLines = (text: string, indent: number, width = WIDTH): string[] => {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/)) {
    if (line && pad.length + 3 + line.length + 1 + word.length > width) {
      lines.push(`${pad}// ${line}`);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(`${pad}// ${line}`);
  return lines;
};

/** A line's code and its trailing `// comment`, if it has one outside a string. */
export const splitComment = (line: string): [string, string | undefined] => {
  let quote: string | undefined;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = undefined;
    } else if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '/' && line[i + 1] === '/') return [line.slice(0, i).trimEnd(), line.slice(i + 2).trim()];
  }
  return [line, undefined];
};

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * One statement (`const x = …;`, an import), printed to the width. A trailing
 * comment that would make the line too long moves above it.
 */
export const formatStatement = (line: string, width = WIDTH): string[] => {
  const indent = line.length - line.trimStart().length;
  const [code, comment] = splitComment(line);
  if (comment !== undefined && line.length <= width) return [line];
  const body = formatExpression(code.trimStart(), indent, indent, 0, width);
  const above = comment === undefined ? [] : commentLines(capitalise(comment), indent, width);
  const pad = ' '.repeat(indent);
  // A value with nothing to break, such as a long string, goes on its own line.
  const assigned = /^(const [\w$]+(?:: [^=]+)? =) (.+)$/.exec(body);
  if (assigned && !body.includes('\n') && indent + body.length > width) return [...above, `${pad}${assigned[1]}`, `${pad}  ${assigned[2]}`];
  return [...above, ...`${pad}${body}`.split('\n')];
};
