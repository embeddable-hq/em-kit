import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { gtmEventFor } from '../config';
import { CodeBlock } from './CodeBlock';

// Docs prose. Internal links are plain paths, which the router intercepts.
export const Markdown = ({ children }: { children: string }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      pre: ({ children: pre }) => {
        const code = pre as { props?: { children?: unknown; className?: string } } | undefined;
        const text = String(code?.props?.children ?? '').replace(/\n$/, '');
        const lang = code?.props?.className?.replace('language-', '');
        return <CodeBlock code={text} label={lang} />;
      },
      table: ({ children: table }) => (
        <div className="doc-table-scroll">
          <table className="doc-table">{table}</table>
        </div>
      ),
      blockquote: ({ children: quote }) => <div className="callout">{quote}</div>,
      ul: ({ children: list }) => <ul className="doc-list">{list}</ul>,
      a: ({ node: _, ...props }) => <a {...props} data-gtm-event={gtmEventFor(props.href)} />,
    }}
  >
    {children}
  </ReactMarkdown>
);
