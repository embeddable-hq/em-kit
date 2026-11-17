import { InlineCode } from '../components/InlineCode';
import { IconAdjustments } from '@tabler/icons-react';
import { ComponentType, Fragment, useMemo, useState } from 'react';
import {
  fieldOptionDefault,
  fieldOptionNote,
  fieldOptionType,
  FIELD_OPTIONS_PATH,
  specificFieldOptions,
} from '../catalog/fieldOptionNotes';
import { ChartEntry, DataState } from '../catalog/registry';
import { CodeBlock } from '../components/CodeBlock';
import { COPY_PAGE_LABEL, CopyButton } from '../components/CopyButton';
import { installCommand } from '../components/InstallCommand';
import { DocsLayout, TocItem } from '../components/DocsLayout';
import { ChartContextBar } from '../components/Switchers';
import { BRAND } from '../config';
import {
  clickPayloadNote,
  codeSettings,
  ComponentExample,
  componentExamples,
  componentPageMarkdown,
  componentPrompt,
  dataStates,
  DEFAULTS_LEGEND,
  exampleText,
  exampleView,
  ignoredNote,
  keyboardRows,
  notesOf,
  propDefault,
  propDescription,
  propShape,
  propsOf,
  propType,
  purposeOf,
  TIME_RANGE_LINK,
  USAGE_SETUP_LINE,
  USAGE_SETUP_PATH,
  typeShapes,
  WrittenExample,
  writtenExamplesOf,
} from '../content/components';
import { RevenueByRegion } from '../examples/PivotSubRows';
import { typeDefinitions } from '../generated/props';
import { playgroundPath } from '../content/routes';
import { useDocumentTitle } from '../router';
import { useCanvas, useSiteSettings } from '../state';

// Every component page is the same five blocks in the same order: header,
// preview, usage, examples, props. tests/componentPages.test.tsx holds it to that.

export { InlineCode };

export { ChartPreview, isWidePreview, LazyMount, previewHeight } from '../components/ChartPreview';
import { ChartPreview, LazyMount, previewHeight } from '../components/ChartPreview';

/** An example's code as the visitor currently sees it: the full module and, after the usage example, an excerpt. */
export const useExampleView = (entry: ChartEntry, example: ComponentExample) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  return useMemo(
    () => exampleView(entry, example, codeSettings({ themeId, languageId, datasetId })),
    [entry, example, themeId, languageId, datasetId],
  );
};

/** The full module of an example as the visitor currently sees it. */
export const useExampleCode = (entry: ChartEntry, example: ComponentExample) => useExampleView(entry, example).code;

// The main preview. Loading, empty and error are states of the same chart, so
// they are a switch on it rather than three more sections down the page.
const Preview = ({ entry, example }: { entry: ChartEntry; example: ComponentExample }) => {
  const [state, setState] = useState<DataState>('ready');
  const hint = dataStates.find((s) => s.id === state)?.hint;
  return (
    <div className="preview">
      <div className="preview__bar">
        <div className="segmented" role="radiogroup" aria-label="Preview state">
          {dataStates.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={state === s.id}
              className={state === s.id ? 'is-active' : ''}
              onClick={() => setState(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <ChartContextBar compact />
      </div>
      <ChartPreview entry={entry} example={example} dataState={state} height={previewHeight(entry, 'page')} eager />
      <p className="preview__hint" aria-live="polite">
        {hint && (
          <>
            <InlineCode>{hint}</InlineCode> <a href="/docs/loading-empty-and-errors">More on states</a>
          </>
        )}
      </p>
    </div>
  );
};

const Example = ({ entry, example }: { entry: ChartEntry; example: ComponentExample }) => {
  const view = useExampleView(entry, example);
  // What it shows, how (the props it turns on), and any default the usage
  // code overrides that this code therefore leaves out: as the twin says it.
  return (
    <section className="component-example" aria-labelledby={example.id}>
      <h3 id={example.id}>{example.name}</h3>
      <p>
        <InlineCode>{exampleText(entry, example)}</InlineCode>
      </p>
      <div className="component-example__frame">
        <ChartPreview entry={entry} example={example} height={previewHeight(entry, 'page')} />
        <CodeBlock code={view.code} marked={view.marked} excerpt={view.excerpt} />
      </div>
    </section>
  );
};

// The hand-written examples, live: each is the module's own component, under
// the page's provider, so it follows the theme and language switchers.
const writtenDemos: Record<string, { Demo: ComponentType; height: number }> = {
  'sub-rows': { Demo: RevenueByRegion, height: 300 },
};

const Written = ({ example }: { example: WrittenExample }) => {
  const canvas = useCanvas();
  const demo = writtenDemos[example.id];
  return (
    <section className="component-example" aria-labelledby={example.id}>
      <h3 id={example.id}>{example.name}</h3>
      <p>
        <InlineCode>{[example.description, ...example.notes].join(' ')}</InlineCode>
      </p>
      <div className="component-example__frame">
        {demo && (
          <div className={`chart-canvas${canvas.dark ? ' is-dark' : ''}`} style={{ background: canvas.background }}>
            <LazyMount height={demo.height}>
              <demo.Demo />
            </LazyMount>
          </div>
        )}
        <CodeBlock code={example.code} label={example.file} />
      </div>
    </section>
  );
};

// Break a long type after an opening bracket, a comma or a bar, never inside a name.
const TypeCode = ({ type }: { type: string }) => (
  <code className="api-table__type">
    {type.split(/(?<=[<(,|])/).map((part, i) => (
      <Fragment key={i}>
        {i > 0 && <wbr />}
        {part}
      </Fragment>
    ))}
  </code>
);

const PropsTable = ({ entry }: { entry: ChartEntry }) => (
  <div className="doc-table-scroll" tabIndex={0} role="region" aria-label={`${entry.name} props`}>
    <table className="doc-table api-table">
      <thead>
        <tr>
          <th scope="col">Prop</th>
          <th scope="col">Type</th>
          <th scope="col">Default</th>
          <th scope="col">Description</th>
        </tr>
      </thead>
      <tbody>
        {propsOf(entry).map((p) => (
          <tr key={p.name}>
            <th scope="row">
              <code>{p.name}</code>
              {p.required && <span className="api-table__required">required</span>}
            </th>
            <td>
              <TypeCode type={propType(p)} />
            </td>
            <td>{propDefault(entry, p) && <TypeCode type={propDefault(entry, p)} />}</td>
            <td>
              <InlineCode>{propDescription(p, entry)}</InlineCode>
              {propShape(p) && <code className="api-table__payload">{propShape(p)}</code>}
              {clickPayloadNote(entry).startsWith(`\`${p.name}\``) && (
                <span className="api-table__note">
                  <InlineCode>{clickPayloadNote(entry)}</InlineCode>
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// The types the props table names and a reader writes or reads by hand
// (`Granularity`, `TimeRange`), as declared. What a click's `TimeRange` holds
// is said once, in the Events guide; the Markdown twin says it in full.
const TypesTable = ({ entry }: { entry: ChartEntry }) => {
  const defined = typeShapes(entry)
    .map((shape) => shape.split(' = ')[0]!)
    .filter((name) => name in typeDefinitions);
  if (!defined.length) return null;
  return (
    <div className="doc-table-scroll" tabIndex={0} role="region" aria-label={`${entry.name} types`}>
      <table className="doc-table api-table types-table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Definition</th>
          </tr>
        </thead>
        <tbody>
          {defined.map((name) => (
            <tr key={name}>
              <th scope="row">
                <code>{name}</code>
              </th>
              <td>
                <TypeCode type={typeDefinitions[name]!} />
                {name === 'TimeRange' && (
                  <span className="api-table__note">
                    <InlineCode>{TIME_RANGE_LINK.text}</InlineCode> <a href={TIME_RANGE_LINK.path}>{TIME_RANGE_LINK.link}</a>.
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// What the component needs around it, in one line under the usage code: the
// install command, once, and a link to the quick start, which teaches the
// provider, the height and the Next.js files. The Markdown twin carries that
// setup in full, so it stands on its own (site/STANDARDS.md, settled conflicts).
const UsageSetup = () => (
  <p className="usage-setup">
    Install with <code>{installCommand('npm')}</code>. <InlineCode>{USAGE_SETUP_LINE}</InlineCode>{' '}
    <a href={USAGE_SETUP_PATH}>Quick start</a>.
  </p>
);

// The keys the component's own controls answer to, on the pages that have
// any beyond the card menu (tables, the pivot table and the heat map).
const Keyboard = ({ entry }: { entry: ChartEntry }) => {
  const rows = keyboardRows(entry);
  if (!rows) return null;
  return (
    <>
      <h3 id="keyboard">Keyboard</h3>
      <div className="doc-table-scroll" tabIndex={0} role="region" aria-label={`${entry.name} keyboard`}>
        <table className="doc-table api-table keyboard-table">
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Where</th>
              <th scope="col">What it does</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.key} ${row.where}`}>
                <th scope="row">
                  <InlineCode>{row.key}</InlineCode>
                </th>
                <td>
                  <InlineCode>{row.where}</InlineCode>
                </td>
                <td>
                  <InlineCode>{row.what}</InlineCode>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        The card menu’s keys, and what is still missing, are in <a href="/docs/accessibility#keyboard">Accessibility</a>.
      </p>
    </>
  );
};

// Only what this component's fields read beyond the options every field takes;
// those are documented once, in the guide.
const FieldOptions = ({ entry }: { entry: ChartEntry }) => {
  const name = String(entry.exportName);
  const rows = specificFieldOptions(name);
  return (
    <>
      <h3 id="field-options">Field options</h3>
      <p>
        {rows.length > 0 ? (
          <>
            Set in a field’s <code>inputs</code>, beside the <a href={FIELD_OPTIONS_PATH}>common options</a>:
          </>
        ) : (
          <>
            <code>{name}</code> reads only the <a href={FIELD_OPTIONS_PATH}>common options</a> in a field’s{' '}
            <code>inputs</code>.
          </>
        )}
      </p>
      {rows.length > 0 && (
        <div className="doc-table-scroll" tabIndex={0} role="region" aria-label={`${entry.name} field options`}>
          <table className="doc-table api-table">
            <thead>
              <tr>
                <th scope="col">Option</th>
                <th scope="col">Type</th>
                <th scope="col">Set on</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ option, fields }) => (
                <tr key={option.name}>
                  <th scope="row">
                    <code>{option.name}</code>
                  </th>
                  <td>
                    <TypeCode type={fieldOptionType(option)} />
                  </td>
                  <td>
                    {fields.map((field) => (
                      <code key={field} className="api-table__field">
                        {field}
                      </code>
                    ))}
                  </td>
                  <td>
                    <InlineCode>{fieldOptionNote(option)}</InlineCode>
                    {fieldOptionDefault(option) && (
                      <>
                        {' '}
                        Default: <code>{fieldOptionDefault(option)}</code>.
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export const ComponentDocPage = ({ entry, route }: { entry: ChartEntry; route: string }) => {
  useDocumentTitle(entry.name, BRAND.name);
  const [usage, ...examples] = componentExamples(entry) as [ComponentExample, ...ComponentExample[]];
  const usageCode = useExampleCode(entry, usage);
  const notes = notesOf(entry);
  const keyboard = keyboardRows(entry);

  const toc: TocItem[] = [
    { id: 'preview', title: 'Preview' },
    { id: 'usage', title: 'Usage' },
    { id: 'examples', title: 'Examples' },
    ...[...examples, ...writtenExamplesOf(entry)].map((e) => ({ id: e.id, title: e.name, depth: 3 as const })),
    { id: 'props', title: 'Props' },
    { id: 'field-options', title: 'Field options', depth: 3 as const },
    ...(keyboard ? [{ id: 'keyboard', title: 'Keyboard', depth: 3 as const }] : []),
  ];

  return (
    <DocsLayout route={route} toc={toc}>
      <div className="component-page">
        <header className="docs-head" data-section="header">
          <span className="docs-head__section">
            <a href="/docs/components">Components</a> · {entry.group}
          </span>
          <h1>{entry.name}</h1>
          <p className="lede">{purposeOf(entry)}</p>
          <div className="docs-head__actions">
            <CopyButton
              kind="markdown"
              label={COPY_PAGE_LABEL}
              getText={() => componentPageMarkdown(entry)}
              title="Copies this page (examples, props and all) as Markdown text, to paste into an AI assistant such as Claude or ChatGPT"
            />
            <CopyButton
              kind="prompt"
              label="Copy prompt"
              title="Copy instructions for an AI coding assistant to add this chart to your app"
              getText={() => componentPrompt(entry, usageCode)}
            />
            <a className="button button--small" href={playgroundPath(entry.id)}>
              <IconAdjustments size={15} stroke={1.75} aria-hidden />
              Open in playground
            </a>
          </div>
        </header>

        <section data-section="preview" aria-labelledby="preview">
          <h2 id="preview" className="sr-only">
            Preview
          </h2>
          <Preview entry={entry} example={usage} />
        </section>

        <section className="docs-content" data-section="usage" aria-labelledby="usage">
          <h2 id="usage">Usage</h2>
          <CodeBlock code={usageCode} />
          {notes.length > 0 && (
            <ul className="doc-list">
              {notes.map((note) => (
                <li key={note}>
                  <InlineCode>{note}</InlineCode>
                </li>
              ))}
            </ul>
          )}
          <UsageSetup />
        </section>

        <section className="docs-content" data-section="examples" aria-labelledby="examples">
          <h2 id="examples">Examples</h2>
          {examples.map((example) => (
            <Example key={example.id} entry={entry} example={example} />
          ))}
          {writtenExamplesOf(entry).map((example) => (
            <Written key={example.id} example={example} />
          ))}
        </section>

        <section className="docs-content" data-section="props" aria-labelledby="props">
          <h2 id="props">Props</h2>
          {(ignoredNote(entry) || !keyboard) && (
            <p>
              <InlineCode>{ignoredNote(entry)}</InlineCode>
              {ignoredNote(entry) && !keyboard && ' '}
              {!keyboard && (
                <>
                  Keyboard and screen readers: <a href="/docs/accessibility">Accessibility</a>.
                </>
              )}
            </p>
          )}
          <PropsTable entry={entry} />
          <p className="api-table__legend">{DEFAULTS_LEGEND}</p>
          <TypesTable entry={entry} />
          <FieldOptions entry={entry} />
          <Keyboard entry={entry} />
        </section>
      </div>
    </DocsLayout>
  );
};
