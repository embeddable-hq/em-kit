import { IconSearch } from '@tabler/icons-react';
import { KeyboardEvent, RefObject, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { searchDocs } from '../search';
import { navigate } from '../router';

// ⌘K / Ctrl+K command palette over every guide, section, component and
// example. A dialog with a combobox and a listbox, operable by keyboard.
export const SearchDialog = ({
  open,
  onClose,
  returnFocus,
}: {
  open: boolean;
  onClose: () => void;
  /** Where focus goes on close when nothing sensible had it on open (a keyboard shortcut, Safari clicks). */
  returnFocus?: RefObject<HTMLElement | null>;
}) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  // The index is built the first time the dialog opens.
  const results = useMemo(() => (open ? searchDocs(query) : []), [open, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    // Give focus back to whatever opened the dialog when it closes.
    const opener = document.activeElement as HTMLElement | null;
    document.body.classList.add('is-menu-open');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.classList.remove('is-menu-open');
      const target = opener && opener !== document.body && opener.isConnected ? opener : returnFocus?.current;
      target?.focus();
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const go = (index: number) => {
    const item = results[index];
    if (!item) return;
    onClose();
    navigate(item.path);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active);
    } else if (e.key === 'Home' && results.length) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && results.length) {
      e.preventDefault();
      setActive(results.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // The input is the only stop in the dialog: keep focus inside it.
      e.preventDefault();
    }
  };

  // Results arrive already grouped (Guides, Components, Examples); number them across groups.
  const groups: { kind: string; items: { item: (typeof results)[number]; index: number }[] }[] = [];
  results.forEach((item, index) => {
    const kind = item.kind;
    const last = groups[groups.length - 1];
    if (last && last.kind === kind) last.items.push({ item, index });
    else groups.push({ kind, items: [{ item, index }] });
  });

  // In a portal: the sticky header has a backdrop-filter, which would make it
  // the containing block of a fixed overlay and trap the dim inside the header.
  return createPortal(
    <div className="search-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Search the docs">
        <div className="search-dialog__input">
          <IconSearch size={18} stroke={1.75} aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            aria-label="Search"
            placeholder="Search components, guides and examples…"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="search-dialog__results" role="listbox" id={listId} ref={listRef} aria-label="Results">
          {results.length === 0 && <p className="search-dialog__empty">No results for “{query}”</p>}
          {groups.map((group) => (
            <div key={group.kind} role="group" aria-label={group.kind}>
              <div className="search-dialog__group" aria-hidden>
                {group.kind}
              </div>
              {group.items.map(({ item, index }) => (
                <div
                  key={`${item.kind}:${item.path}:${item.title}:${item.hint}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`search-dialog__item${index === active ? ' is-active' : ''}`}
                  onMouseMove={() => active !== index && setActive(index)}
                  onClick={() => go(index)}
                >
                  <span className="search-dialog__title">{item.code ? <code>{item.title}</code> : item.title}</span>
                  {item.hint && <span className="search-dialog__hint">{item.hint}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="search-dialog__footer" aria-hidden>
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>↵</kbd> to open
          </span>
          <span>
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
};
