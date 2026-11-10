import { useMemo, useState } from 'react';
import { highlight } from 'sugar-high';

type CodeBlockProps = {
  code: string;
  label?: string;
  compact?: boolean;
  /** Prose or other non-code text: skip highlighting and wrap long lines. */
  plain?: boolean;
  /** Scroll the body past this height (px) instead of growing the block. */
  maxHeight?: number;
};

export const CodeBlock = ({ code, label, compact, plain, maxHeight }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => (plain ? '' : highlight(code)), [code, plain]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`code-block${compact ? ' code-block--compact' : ''}${plain ? ' code-block--plain' : ''}`}>
      <div className="code-block__bar">
        <span className="code-block__label">{label ?? 'tsx'}</span>
        <button type="button" className="code-block__copy" onClick={copy} aria-label="Copy code">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={maxHeight ? { maxHeight } : undefined} tabIndex={maxHeight ? 0 : undefined}>
        {plain ? <code>{code}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
      </pre>
    </div>
  );
};
