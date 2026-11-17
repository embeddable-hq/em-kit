import { IconSearch } from '@tabler/icons-react';
import { RefObject, useEffect, useRef, useState } from 'react';
import { chunk, useChunkWhenReady } from '../chunks';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// The dialog, the search index and what the index is built from load the first
// time they are wanted: when the button is pointed at or focused, or the
// shortcut is pressed. Every page has this button; few visitors open the dialog.
const dialog = chunk('components/SearchDialog.tsx', () => import('./SearchDialog').then((m) => m.SearchDialog));
const prefetch = () => void dialog.preload()?.catch(() => undefined);

// Mounted once the dialog is wanted: fetches it, then renders it.
const LoadedDialog = (props: { open: boolean; onClose: () => void; returnFocus: RefObject<HTMLElement | null> }) => {
  const { value: Dialog } = useChunkWhenReady(dialog);
  return Dialog ? <Dialog {...props} /> : null;
};

// The nav's search button, and the ⌘K shortcut that opens the same dialog.
export const SearchButton = () => {
  const [open, setOpen] = useState(false);
  // Once it has been wanted the dialog stays mounted, closed.
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (open) setWanted(true);
  }, [open]);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // "/" opens it too, unless the visitor is typing somewhere.
        const el = e.target as HTMLElement | null;
        if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="search-button"
        onClick={() => setOpen(true)}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        aria-haspopup="dialog"
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K /"
      >
        <IconSearch size={16} stroke={1.75} aria-hidden />
        <span className="search-button__label">Search…</span>
        <kbd>{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      {wanted && <LoadedDialog open={open} onClose={() => setOpen(false)} returnFocus={buttonRef} />}
    </>
  );
};
