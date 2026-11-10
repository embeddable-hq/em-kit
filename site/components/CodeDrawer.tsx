import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { CodeBlock } from './CodeBlock';

type CodeDrawerProps = {
  title: string;
  description?: string;
  notes: string[];
  code: string;
  footer?: ReactNode;
  onClose: () => void;
};

// `code` spans inside a note, written with backticks.
const renderNote = (note: string) =>
  note.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );

export const CodeDrawer = ({ title, description, notes, code, footer, onClose }: CodeDrawerProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Focus moves into the panel and back to the opener on close; Escape closes;
  // the page behind doesn't scroll while it's open.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="drawer" role="presentation">
      <div className="drawer__backdrop" onClick={onClose} aria-hidden />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer__head">
          <div>
            <h2 id="drawer-title">{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button ref={closeRef} type="button" className="drawer__close" onClick={onClose} aria-label="Close code">
            <IconX size={18} aria-hidden />
          </button>
        </header>
        <div className="drawer__body">
          {notes.length > 0 && (
            <ul className="drawer__notes">
              {notes.map((note) => (
                <li key={note}>{renderNote(note)}</li>
              ))}
            </ul>
          )}
          <CodeBlock code={code} />
        </div>
        {footer && <footer className="drawer__foot">{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
};
