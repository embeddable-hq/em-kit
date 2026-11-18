import { IconCheck, IconCopy, IconMarkdown } from '@tabler/icons-react';
import { useState } from 'react';

type CopyKind = 'code' | 'markdown';

const icons = { code: IconCopy, markdown: IconMarkdown };

// What each kind is for, said once the text is on the clipboard: a visitor who
// did not know what "as Markdown" was for learns it at the moment it is useful.
const copiedLabels: Record<CopyKind, string> = {
  code: 'Copied',
  markdown: 'Copied: paste it into an AI assistant',
};

/** The label of every button that copies a page of the docs as Markdown. */
export const COPY_PAGE_LABEL = 'Copy page as Markdown';

// A button that copies text produced on click (so a page's Markdown is only
// built when asked for), and says so for a moment.
export const CopyButton = ({
  getText,
  label,
  kind,
  title,
}: {
  getText: () => string;
  label: string;
  kind: CopyKind;
  title?: string;
}) => {
  const [copied, setCopied] = useState(false);
  const Icon = copied ? IconCheck : icons[kind];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), kind === 'code' ? 1600 : 3200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="button button--small copy-button" onClick={copy} title={title}>
      <Icon size={15} stroke={1.75} aria-hidden />
      <span aria-live="polite">{copied ? copiedLabels[kind] : label}</span>
    </button>
  );
};
