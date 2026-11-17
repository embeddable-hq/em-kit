/** Text with `code` spans, as the notes and descriptions are written. */
export const InlineCode = ({ children }: { children: string }) => (
  <>
    {children
      .split(/(`[^`]+`)/g)
      .map((part, i) => (part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part))}
  </>
);
