import { IconSearch } from '@tabler/icons-react';
import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { searchDocs } from '../docs/nav';
import { navigate } from '../router';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// ⌘K / Ctrl+K command palette over every guide, section, component and
// example. A dialog with a combobox and a listbox, operable by keyboard.
export const SearchDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const results = useMemo(() => searchDocs(query), [query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
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
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';
  return (
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
            placeholder="Search components, guides and examples…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="search-dialog__results" role="listbox" id={listId} ref={listRef} aria-label="Results">
          {results.length === 0 && <li className="search-dialog__empty">No results for “{query}”</li>}
          {results.map((item, i) => {
            const heading = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.path} role="presentation">
                {heading && (
                  <div className="search-dialog__group" role="presentation">
                    {heading}
                  </div>
                )}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`search-dialog__item${i === active ? ' is-active' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(i)}
                >
                  <span>{item.title}</span>
                  {item.hint && <span className="search-dialog__hint">{item.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// The nav's search button, and the ⌘K shortcut that opens the same dialog.
export const SearchButton = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button type="button" className="search-button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <IconSearch size={15} stroke={1.75} aria-hidden />
        <span className="search-button__label">Search docs…</span>
        <kbd>{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <SearchDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
};
