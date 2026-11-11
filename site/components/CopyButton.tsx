import { IconCheck, IconCopy, IconMarkdown, IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';

type CopyKind = 'code' | 'prompt' | 'markdown';

const icons = { code: IconCopy, prompt: IconSparkles, markdown: IconMarkdown };

// A button that copies text produced on click (so large Markdown or prompts
// are only built when asked for), and says so for a moment.
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
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="button button--small copy-button" onClick={copy} title={title}>
      <Icon size={15} stroke={1.75} aria-hidden />
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
};
