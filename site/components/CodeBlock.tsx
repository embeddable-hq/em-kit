import { useMemo, useState } from 'react';
import { highlight } from 'sugar-high';

type CodeBlockProps = { code: string; label?: string; compact?: boolean };

export const CodeBlock = ({ code, label, compact }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlight(code), [code]);

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
    <div className={`code-block${compact ? ' code-block--compact' : ''}`}>
      <div className="code-block__bar">
        <span className="code-block__label">{label ?? 'tsx'}</span>
        <button type="button" className="code-block__copy" onClick={copy} aria-label="Copy code">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
};
