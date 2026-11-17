import { useMemo, useState } from 'react';
import { highlight } from 'sugar-high';

type Marked = { code: string; marked: number[] };

type CodeBlockProps = {
  code: string;
  label?: string;
  compact?: boolean;
  /** Prose or other non-code text: skip highlighting and wrap long lines. */
  plain?: boolean;
  /** Scroll the body past this height (px) instead of growing the block. */
  maxHeight?: number;
  /** Lines of `code` to highlight (0-based): what differs from the usage example. */
  marked?: number[];
  /**
   * Shown in place of `code` until the reader opens the full file. Copy always
   * copies `code`. The full file is in the HTML either way, inside a
   * `<details>`, so it reads without JavaScript.
   */
  excerpt?: Marked;
};

// sugar-high prints one `<span class="sh__line">` per line, joined by newlines.
const withMarks = (html: string, marked: number[] = []) => {
  if (!marked.length) return html;
  const set = new Set(marked);
  return html
    .split('\n')
    .map((line, i) => (set.has(i) ? line.replace('<span class="sh__line">', '<span class="sh__line sh__line--marked">') : line))
    .join('\n');
};

const lineCount = (code: string) => code.split('\n').length;

export const CodeBlock = ({ code, label, compact, plain, maxHeight, marked, excerpt }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const html = useMemo(() => (plain ? '' : withMarks(highlight(code), marked)), [code, plain, marked]);
  const excerptHtml = useMemo(() => (excerpt ? withMarks(highlight(excerpt.code), excerpt.marked) : ''), [excerpt]);
  const hasMarks = Boolean(marked?.length || excerpt?.marked.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const body = (
    <pre style={maxHeight ? { maxHeight } : undefined} tabIndex={maxHeight ? 0 : undefined}>
      {plain ? <code>{code}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
    </pre>
  );

  const copyButton = (
    <button
      type="button"
      className="code-block__copy"
      onClick={copy}
      aria-label="Copy code"
      title={excerpt ? 'Copy the whole file' : undefined}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );

  const className = `code-block${compact ? ' code-block--compact' : ''}${plain ? ' code-block--plain' : ''}`;
  const labelText = (
    <span className="code-block__label">
      {label ?? 'tsx'}
      {hasMarks && (
        <span className="code-block__legend">
          <span className="code-block__swatch" aria-hidden />
          Differs from <a href="#usage">Usage</a>
        </span>
      )}
    </span>
  );

  if (!excerpt) {
    return (
      <div className={className}>
        <div className="code-block__bar">
          {labelText}
          {copyButton}
        </div>
        {body}
      </div>
    );
  }

  // An excerpt: the toggle and Copy sit in the bar (see styles/code.css), in
  // the order they read, and the toggle never moves when it opens.
  return (
    <div className={`${className} code-block--excerpt`}>
      <div className="code-block__bar">{labelText}</div>
      <details className="code-block__full" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary>{open ? 'Hide full code' : `Show full code (${lineCount(code)} lines)`}</summary>
        {body}
      </details>
      {copyButton}
      <pre className="code-block__excerpt">
        <code dangerouslySetInnerHTML={{ __html: excerptHtml }} />
      </pre>
    </div>
  );
};
