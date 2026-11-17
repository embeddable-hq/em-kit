import { IconCode, IconX } from '@tabler/icons-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { highlight } from 'sugar-high';
import { COPY_PAGE_LABEL, CopyButton } from '../components/CopyButton';
import { DocsLayout } from '../components/DocsLayout';
import { ChartContextBar } from '../components/Switchers';
import { chartEntries, chartGroups, ChartEntry } from '../catalog/registry';
import { BRAND } from '../config';
import { codeSettings, componentExamples, componentsIndexMarkdown, exampleCode } from '../content/components';
import { componentPath } from '../content/routes';
import { useDocumentTitle } from '../router';
import { useSiteSettings } from '../state';
import { ChartPreview, isWidePreview } from '../components/ChartPreview';

// Every component on one page, live, grouped by type. One preview per
// component, its default, or the preset the registry names for a card when the
// default needs a page's width: its other presets are on its own page.

type Group = (typeof chartGroups)[number];

const groupId = (group: Group) => group.toLowerCase();
const entriesOf = (group: Group) => chartEntries.filter((e) => e.group === group);

/** The example a component's card shows and copies. */
export const cardExample = (entry: ChartEntry) => {
  const examples = componentExamples(entry);
  return examples.find((example) => entry.cardVariant && example.variantId === entry.cardVariant) ?? examples[0]!;
};

const panelId = (entry: ChartEntry) => `code-${entry.id}`;
const viewButtonId = (entry: ChartEntry) => `view-code-${entry.id}`;

const Card = ({ entry, open, onToggle }: { entry: ChartEntry; open: boolean; onToggle: () => void }) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const usage = cardExample(entry);
  const codeFor = () => exampleCode(entry, usage, codeSettings({ themeId, languageId, datasetId }));
  return (
    <article className={`index-card${isWidePreview(entry) ? ' index-card--wide' : ''}${open ? ' is-open' : ''}`}>
      <ChartPreview entry={entry} example={usage} size="card" />
      <div className="index-card__meta">
        <h3>
          <a href={componentPath(entry.id)}>{entry.name}</a>
        </h3>
        <code className="index-card__export">{String(entry.exportName)}</code>
        <div className="index-card__row">
          <div className="index-card__actions">
            <button
              type="button"
              id={viewButtonId(entry)}
              className="button button--small index-card__view"
              aria-expanded={open}
              aria-controls={panelId(entry)}
              onClick={onToggle}
            >
              <IconCode size={15} stroke={1.75} aria-hidden />
              {open ? 'Hide code' : 'View code'}
            </button>
            <CopyButton
              kind="code"
              label="Copy code"
              title={`Copy the code for this ${entry.name}`}
              getText={codeFor}
            />
          </div>
        </div>
      </div>
    </article>
  );
};

// A card's code, opened across the whole row under the card's row, so the
// lines are read at the page's width rather than scrolled sideways in a third
// of it. Built only when open.
const CodePanel = ({ entry, open, onClose }: { entry: ChartEntry; open: boolean; onClose: () => void }) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const usage = cardExample(entry);
  const code = useMemo(
    () => (open ? exampleCode(entry, usage, codeSettings({ themeId, languageId, datasetId })) : ''),
    [open, entry, usage, themeId, languageId, datasetId],
  );
  const html = useMemo(() => (code ? highlight(code) : ''), [code]);
  const close = () => {
    onClose();
    document.getElementById(viewButtonId(entry))?.focus();
  };
  return (
    <div
      className="index-code"
      id={panelId(entry)}
      role="region"
      aria-label={`Code for ${entry.name}`}
      hidden={!open}
    >
      {open && (
        <>
          <div className="index-code__head">
            <span className="index-code__title">
              {entry.name} <code>{`<${String(entry.exportName)} />`}</code>
            </span>
            <span className="index-code__lines">{code.split('\n').length} lines</span>
            <div className="index-code__actions">
              <CopyButton kind="code" label="Copy code" title={`Copy the code for this ${entry.name}`} getText={() => code} />
              <button type="button" className="button button--small" onClick={close}>
                <IconX size={15} stroke={1.75} aria-hidden />
                Close
              </button>
            </div>
          </div>
          <div className="index-code__body code-block">
            <pre tabIndex={0} aria-label={`Code for this ${entry.name}`}>
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        </>
      )}
    </div>
  );
};

// How many cards share a row, from the width the index has (the container
// queries in components.css): three across, two, or one.
const useColumns = () => {
  const [columns, setColumns] = useState<1 | 2 | 3>(3);
  useEffect(() => {
    const el = document.querySelector('.components-index');
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([item]) => {
      const width = item?.contentRect.width ?? 0;
      setColumns(width >= 1040 ? 3 : width >= 680 ? 2 : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return columns;
};

/** The group's cards in rows as the grid lays them out: a wide card takes half a row, or a whole one at two across. */
export const rowsOf = (entries: ChartEntry[], columns: 1 | 2 | 3): ChartEntry[][] => {
  const tracks = columns === 3 ? 6 : columns;
  const span = (entry: ChartEntry) => (columns === 1 ? 1 : columns === 2 ? (isWidePreview(entry) ? 2 : 1) : isWidePreview(entry) ? 3 : 2);
  const rows: ChartEntry[][] = [];
  let used = tracks;
  for (const entry of entries) {
    if (used + span(entry) > tracks) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1]!.push(entry);
    used += span(entry);
  }
  return rows;
};

// A group's cards, and each card's code panel after the last card of its row,
// so the panel opens under the row it belongs to and is next in the tab order.
const GroupGrid = ({ entries, columns }: { entries: ChartEntry[]; columns: 1 | 2 | 3 }) => {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) => setOpen((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  return (
    <div className="index-grid">
      {rowsOf(entries, columns).map((row) => (
        <Fragment key={row[0]!.id}>
          {row.map((entry) => (
            <Card key={entry.id} entry={entry} open={open.includes(entry.id)} onToggle={() => toggle(entry.id)} />
          ))}
          {row.map((entry) => (
            <CodePanel key={`code-${entry.id}`} entry={entry} open={open.includes(entry.id)} onClose={() => toggle(entry.id)} />
          ))}
        </Fragment>
      ))}
    </div>
  );
};

const Count = ({ n }: { n: number }) => (
  <>
    {n}
    <span className="sr-only">{n === 1 ? ' component' : ' components'}</span>
  </>
);

// Jump links for the groups, with the count in each and the group being read
// marked. They are real links, so they work before the page's script runs.
const GroupNav = ({ route }: { route: string }) => {
  const [active, setActive] = useState<Group>(chartGroups[0]);

  useEffect(() => {
    // The group whose heading last passed under the sticky bar; at the foot of
    // the page, the last group, which can never scroll that far up.
    const update = () => {
      const sections = [...document.querySelectorAll<HTMLElement>('[data-group]')];
      const atFoot = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const passed = sections.filter((el) => el.getBoundingClientRect().top <= 180);
      const current = atFoot ? sections[sections.length - 1] : (passed[passed.length - 1] ?? sections[0]);
      const group = current?.getAttribute('data-group') as Group | null;
      if (group) setActive(group);
    };
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <nav className="index-nav" aria-label="Component groups">
      {chartGroups.map((group) => (
        <a
          key={group}
          href={`${route}#${groupId(group)}`}
          className={active === group ? 'is-active' : ''}
          aria-current={active === group ? 'true' : undefined}
        >
          {group}
          <span className="index-nav__count">
            <Count n={entriesOf(group).length} />
          </span>
        </a>
      ))}
    </nav>
  );
};

export const ComponentsIndex = ({ route }: { route: string }) => {
  useDocumentTitle('Components', BRAND.name);
  const columns = useColumns();
  return (
    <DocsLayout route={route} toc={[]}>
      <div className="components-index">
        <header className="docs-head">
          <h1>Components</h1>
          <p className="lede">
            All {chartEntries.length} components, live. Hover and click them, change the theme, language or data, then open
            one for its examples and props.
          </p>
          <div className="docs-head__actions">
            <CopyButton
              kind="markdown"
              label={COPY_PAGE_LABEL}
              getText={componentsIndexMarkdown}
              title="Copies this list of every component as Markdown text, to paste into an AI assistant such as Claude or ChatGPT"
            />
          </div>
        </header>

        <div className="index-bar">
          <GroupNav route={route} />
          <ChartContextBar compact />
        </div>

        {chartGroups.map((group) => {
          const entries = entriesOf(group);
          return (
            <section key={group} className="index-group" data-group={group} aria-labelledby={groupId(group)}>
              <h2 id={groupId(group)}>
                {group}{' '}
                <span className="index-group__count">
                  <Count n={entries.length} />
                </span>
              </h2>
              <GroupGrid entries={entries} columns={columns} />
            </section>
          );
        })}
      </div>
    </DocsLayout>
  );
};
