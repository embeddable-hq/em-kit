import { useMemo, useState } from 'react';
import type { FieldInputs, Granularity } from '../../src';
import { CodeBlock } from '../components/CodeBlock';
import { DatasetSelect, LanguageSwitcher, ThemeSwitcher } from '../components/Switchers';
import { useChart } from '../components/useChart';
import { ChartSettings } from '../catalog/build';
import { propNote } from '../catalog/propNotes';
import { chartEntries, ChartEntry, DataState, getVariant } from '../catalog/registry';
import { componentFieldOptions, componentProps, FieldDoc, FieldOptionDoc, PropDoc } from '../generated/props';
import { BRAND } from '../config';
import { href, navigate, useDocumentTitle } from '../router';
import { useCanvas, useSiteSettings } from '../state';

const dataStates: { id: DataState; label: string }[] = [
  { id: 'ready', label: 'Data' },
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'error', label: 'Error' },
];

const granularities: Granularity[] = ['day', 'week', 'month', 'quarter', 'year'];

type Tab = 'preview' | 'code' | 'data';

// How each prop is edited, inferred from its generated type.
type ControlKind = 'boolean' | 'number' | 'text' | 'color' | 'granularity' | 'event' | 'data';

const controlKind = (prop: PropDoc, entry: ChartEntry): ControlKind => {
  if (prop.name === 'granularity') return entry.usesGranularity ? 'granularity' : 'data';
  if (prop.type.includes('=>')) return prop.name.startsWith('on') ? 'event' : 'data';
  if (prop.type === 'boolean') return 'boolean';
  if (prop.type === 'number') return 'number';
  if (prop.type === 'string') return /color$/i.test(prop.name) ? 'color' : 'text';
  return 'data';
};

const propTooltip = (prop: PropDoc) => {
  const note = propNote(prop.name) ?? prop.doc;
  return `${prop.required ? 'required · ' : ''}${prop.type}${note ? `\n${note}` : ''}`;
};

const safeStringify = (value: unknown) => {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]';
        seen.add(v);
      }
      return v;
    },
    2,
  );
};

// Titles and labels are "key|fallback" translation strings; show the readable part.
const displayString = (value: unknown) => {
  const s = String(value ?? '');
  return s.includes('|') ? (s.split('|').pop() ?? '') : s;
};

// Options with no sensible inline control, or already driven elsewhere.
const UNEDITABLE_TYPES = new Set(['timeRange', 'granularity']);

type FieldValues = Record<string, unknown>;

const FieldOptionControl = ({
  id,
  option,
  value,
  isSet,
  onChange,
}: {
  id: string;
  option: FieldOptionDoc;
  value: unknown;
  isSet: boolean;
  onChange: (value: unknown) => void;
}) => {
  const label = (
    <label className="control__label control__label--prop" htmlFor={id}>
      {option.name}
    </label>
  );
  const title = optionDescription(option);

  if (option.type === 'boolean') {
    return (
      <label className="switch" title={title}>
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" aria-hidden />
        <code className="switch__prop">{option.name}</code>
      </label>
    );
  }

  if (option.options?.length && option.array) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset className="control field-control__checks" title={title}>
        <legend className="control__label control__label--prop">{option.name}</legend>
        <div className="prop-chips">
          {option.options.map((o) => (
            <label key={o} className={`check-chip${selected.includes(o) ? ' is-active' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div className="control" title={title}>
      {label}
      {option.options?.length ? (
        <select
          id={id}
          className="select"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
        >
          <option value="">default</option>
          {option.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : option.type === 'color' ? (
        <span className="color-control">
          <input
            id={id}
            type="color"
            value={typeof value === 'string' && value.startsWith('#') ? value : '#808080'}
            onChange={(e) => onChange(e.target.value)}
          />
          {isSet ? (
            <button type="button" className="text-button" onClick={() => onChange(undefined)}>
              Clear
            </button>
          ) : (
            <span className="muted">theme</span>
          )}
        </span>
      ) : option.type === 'number' ? (
        <input
          id={id}
          className="input"
          type="number"
          value={value === undefined ? '' : Number(value)}
          placeholder="auto"
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      ) : (
        <input
          id={id}
          className="input"
          value={String(value ?? '')}
          placeholder="not set"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};

// One collapsible group per field prop. Values apply to every field the prop
// holds, so a list prop like `measures` changes all its measures at once.
const FieldOptionsControls = ({
  fields,
  builtProps,
  overrides,
  setOption,
}: {
  fields: Record<string, FieldDoc>;
  builtProps: Record<string, unknown>;
  overrides: Record<string, FieldValues>;
  setOption: (field: string, option: string, value: unknown) => void;
}) => {
  const present = Object.entries(fields).filter(([name, field]) => {
    const value = builtProps[name];
    return value != null && (!Array.isArray(value) || value.length > 0) && field.inputs.length > 0;
  });
  if (present.length === 0) return null;

  return (
    <>
      <div className="controls__group-head controls__group-head--divided">
        <h3>Field options</h3>
        <p>Set on each field&rsquo;s inputs. A list prop applies them to every field in it.</p>
      </div>
      {present.map(([name, field]) => {
        const value = builtProps[name];
        const first = (Array.isArray(value) ? value[0] : value) as { inputs?: FieldValues } | undefined;
        const editable = field.inputs.filter((o) => !UNEDITABLE_TYPES.has(o.type));
        const setCount = Object.values(overrides[name] ?? {}).filter((v) => v !== undefined).length;
        const switches = editable.filter((o) => o.type === 'boolean');
        const others = editable.filter((o) => o.type !== 'boolean');
        return (
          <details key={name} className="field-control">
            <summary>
              <code>{name}</code>
              <span className="muted">{setCount > 0 ? `${setCount} set` : `${editable.length} options`}</span>
            </summary>
            <div className="field-control__body">
              {others.map((option) => (
                <FieldOptionControl
                  key={option.name}
                  id={`field-${name}-${option.name}`}
                  option={option}
                  value={first?.inputs?.[option.name]}
                  isSet={overrides[name]?.[option.name] !== undefined}
                  onChange={(v) => setOption(name, option.name, v)}
                />
              ))}
              {switches.length > 0 && (
                <div className="control">
                  <div className="switches">
                    {switches.map((option) => (
                      <FieldOptionControl
                        key={option.name}
                        id={`field-${name}-${option.name}`}
                        option={option}
                        value={first?.inputs?.[option.name]}
                        isSet={overrides[name]?.[option.name] !== undefined}
                        onChange={(v) => setOption(name, option.name, v)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </>
  );
};

const Playground = ({ entry, variantId }: { entry: ChartEntry; variantId?: string }) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const canvas = useCanvas();
  const [tab, setTab] = useState<Tab>('preview');
  const [dataState, setDataState] = useState<DataState>('ready');
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, FieldInputs>>({});

  const setFieldOption = (field: string, option: string, value: unknown) =>
    setFieldOverrides((prev) => {
      const values: FieldValues = { ...prev[field] };
      if (value === undefined) delete values[option];
      else values[option] = value;
      return { ...prev, [field]: values as FieldInputs };
    });

  const setOverride = (name: string, value: unknown) =>
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[name];
      else next[name] = value;
      return next;
    });

  const settings = useMemo<ChartSettings>(
    () => ({
      themeId,
      languageId,
      datasetId,
      dataState,
      variantId,
      toggles: {},
      overrides,
      fieldOverrides,
    }),
    [themeId, languageId, datasetId, dataState, variantId, overrides, fieldOverrides],
  );
  const { built, Component, events, clearEvents, granularity, setGranularity } = useChart(entry, settings);

  const docs = componentProps[String(entry.exportName)] ?? [];
  const byKind = useMemo(() => {
    const groups: Record<ControlKind, PropDoc[]> = {
      boolean: [],
      number: [],
      text: [],
      color: [],
      granularity: [],
      event: [],
      data: [],
    };
    const ordered = [...docs.filter((p) => p.required), ...docs.filter((p) => !p.required)];
    for (const prop of ordered) {
      // Implied by the granularity picker; not worth a row of its own.
      if (prop.name === 'setGranularity' && entry.usesGranularity) continue;
      groups[controlKind(prop, entry)].push(prop);
    }
    return groups;
  }, [docs, entry]);

  // Card text first, instrumentation last, the chart's own props in between.
  const rank = (prop: PropDoc) => {
    const first = ['title', 'description', 'tooltip'];
    const last = ['componentName', 'trackingId'];
    if (first.includes(prop.name)) return first.indexOf(prop.name) - first.length;
    if (last.includes(prop.name)) return 1 + last.indexOf(prop.name);
    return 0;
  };
  const inputs = [...byKind.text, ...byKind.number, ...byKind.color].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="playground">
      <div className="playground__main">
        <div className="tabs" role="tablist" aria-label="View">
          {(['preview', 'code', 'data'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? 'is-active' : ''}
              onClick={() => setTab(t)}
            >
              {t === 'preview' ? 'Preview' : t === 'code' ? 'Code' : 'Data'}
            </button>
          ))}
        </div>

        {tab === 'preview' && (
          <>
            <div
              className={`playground__canvas${canvas.dark ? ' is-dark' : ''}`}
              style={{ background: canvas.background }}
            >
              <div style={{ height: 480 }}>
                <Component {...built.props} />
              </div>
            </div>
            <div className="events">
              <div className="events__head">
                <h3>Events</h3>
                {events.length > 0 && (
                  <button type="button" className="text-button" onClick={clearEvents}>
                    Clear
                  </button>
                )}
              </div>
              {events.length === 0 ? (
                <p className="muted">Click a data point to see the payload your handler receives.</p>
              ) : (
                <ul className="events__list">
                  {events.map((e) => (
                    <li key={e.id}>
                      <span className="events__name">{e.name}</span>
                      <span className="muted">{e.at}</span>
                      <pre>{safeStringify(e.payload)}</pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        {tab === 'code' && (
          <div className="playground__panel">
            <p className="muted">
              Generated from the current settings, prop edits included. Replace the sample rows with your own query and
              it runs as-is.
            </p>
            <CodeBlock code={built.code} />
          </div>
        )}

        {tab === 'data' && (
          <div className="playground__panel">
            <p className="muted">
              The rows passed to the chart. One object per row; keys match each field’s <code>name</code>. Time values
              are ISO strings, keyed by both the field name and <code>name.granularity</code>.
            </p>
            {built.sampleRows.length === 0 ? (
              <p className="muted">No rows in the “{dataState}” state.</p>
            ) : (
              built.sampleRows.map(({ varName, rows }) => (
                <CodeBlock
                  key={varName}
                  label={`${varName} · ${rows.length} rows`}
                  code={safeStringify(rows.slice(0, 12)) + (rows.length > 12 ? `\n// … ${rows.length - 12} more` : '')}
                />
              ))
            )}
          </div>
        )}
      </div>

      <aside className="controls" aria-label="Chart settings">
        <div className="controls__group-head">
          <h3>Preview context</h3>
          <p>How this chart looks in your app.</p>
        </div>
        <div className="control">
          <span className="control__label">Chart theme</span>
          <ThemeSwitcher showLabels />
        </div>
        <div className="control">
          <span className="control__label">Chart language</span>
          <LanguageSwitcher />
        </div>
        <div className="control">
          <span className="control__label">Sample data</span>
          <DatasetSelect />
        </div>
        <div className="control">
          <span className="control__label">Data state</span>
          <div className="segmented segmented--wrap" role="radiogroup" aria-label="Data state">
            {dataStates.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={dataState === s.id}
                className={dataState === s.id ? 'is-active' : ''}
                onClick={() => setDataState(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="controls__group-head controls__group-head--divided">
          <h3>Props</h3>
          <p>
            All of them, live: edits update the preview and the code together. Hover a prop for what it does.
            {(Object.keys(overrides).length > 0 || Object.keys(fieldOverrides).length > 0) && (
              <>
                {' '}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setOverrides({});
                    setFieldOverrides({});
                  }}
                >
                  Reset
                </button>
              </>
            )}
          </p>
        </div>

        {entry.variants && entry.variants.length > 0 && (
          <div className="control">
            <label className="control__label" htmlFor="chart-variant">
              Preset
            </label>
            <select
              id="chart-variant"
              className="select"
              value={variantId ?? ''}
              onChange={(e) => {
                navigate(`/charts/${entry.id}${e.target.value ? `/${e.target.value}` : ''}`);
              }}
            >
              <option value="">{entry.name}</option>
              {entry.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {byKind.granularity.map((prop) => (
          <div className="control" key={prop.name} title={propTooltip(prop)}>
            <label className="control__label control__label--prop" htmlFor={`prop-${prop.name}`}>
              {prop.name}
            </label>
            <select
              id={`prop-${prop.name}`}
              className="select"
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
            >
              {granularities.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        ))}

        {inputs.map((prop) => {
          const kind = controlKind(prop, entry);
          const current = built.props[prop.name];
          return (
            <div className="control" key={prop.name} title={propTooltip(prop)}>
              <label className="control__label control__label--prop" htmlFor={`prop-${prop.name}`}>
                {prop.name}
              </label>
              {kind === 'number' ? (
                <input
                  id={`prop-${prop.name}`}
                  className="input"
                  type="number"
                  value={current === undefined ? '' : Number(current)}
                  placeholder="auto"
                  onChange={(e) => setOverride(prop.name, e.target.value === '' ? undefined : Number(e.target.value))}
                />
              ) : kind === 'color' ? (
                <span className="color-control">
                  <input
                    id={`prop-${prop.name}`}
                    type="color"
                    value={typeof current === 'string' && current.startsWith('#') ? current : '#808080'}
                    onChange={(e) => setOverride(prop.name, e.target.value)}
                  />
                  {overrides[prop.name] !== undefined ? (
                    <button type="button" className="text-button" onClick={() => setOverride(prop.name, undefined)}>
                      Clear
                    </button>
                  ) : (
                    <span className="muted">theme</span>
                  )}
                </span>
              ) : (
                <input
                  id={`prop-${prop.name}`}
                  className="input"
                  value={displayString(current)}
                  placeholder="not set"
                  onChange={(e) => setOverride(prop.name, e.target.value === '' ? undefined : e.target.value)}
                />
              )}
            </div>
          );
        })}

        {byKind.boolean.length > 0 && (
          <div className="control">
            <div className="switches">
              {byKind.boolean.map((prop) => (
                <label key={prop.name} className="switch" title={propTooltip(prop)}>
                  <input
                    type="checkbox"
                    checked={Boolean(built.props[prop.name])}
                    onChange={(e) => setOverride(prop.name, e.target.checked)}
                  />
                  <span className="switch__track" aria-hidden />
                  <code className="switch__prop">{prop.name}</code>
                </label>
              ))}
            </div>
          </div>
        )}

        <FieldOptionsControls
          fields={componentFieldOptions[String(entry.exportName)] ?? {}}
          builtProps={built.props}
          overrides={fieldOverrides as Record<string, FieldValues>}
          setOption={setFieldOption}
        />

        {byKind.data.length > 0 && (
          <div className="control">
            <span className="control__label">From the sample data</span>
            <div className="prop-chips">
              {byKind.data.map((prop) => (
                <code key={prop.name} className="prop-chip" title={propTooltip(prop)}>
                  {prop.name}
                </code>
              ))}
            </div>
          </div>
        )}

        {byKind.event.length > 0 && (
          <div className="control">
            <span className="control__label">Events · logged under the preview</span>
            <div className="prop-chips">
              {byKind.event.map((prop) => (
                <code key={prop.name} className="prop-chip" title={propTooltip(prop)}>
                  {prop.name}
                </code>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

const optionType = (option: FieldOptionDoc) => {
  const base = option.options?.length ? option.options.map((o) => `'${o}'`).join(' | ') : option.type;
  if (!option.array) return base;
  return option.options && option.options.length > 1 ? `(${base})[]` : `${base}[]`;
};

const optionDescription = (option: FieldOptionDoc) => {
  const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
  const parts = [sentence(option.label)];
  if (option.description) parts.push(sentence(option.description));
  if (option.supportedTypes) parts.push(`Only on ${option.supportedTypes.join(' and ')} fields.`);
  if (option.defaultValue !== undefined) parts.push(`Default: ${JSON.stringify(option.defaultValue)}.`);
  return parts.join(' ');
};

// One row per option, listing the field props that read it: most options
// repeat across a chart's fields, so a table per field would mostly repeat.
export const FieldOptions = ({ entry }: { entry: ChartEntry }) => {
  const fields = componentFieldOptions[String(entry.exportName)] ?? {};
  const rows = useMemo(() => {
    const byName = new Map<string, { option: FieldOptionDoc; fields: string[] }>();
    for (const [fieldName, field] of Object.entries(fields)) {
      for (const option of field.inputs) {
        const row = byName.get(option.name);
        if (row) row.fields.push(fieldName);
        else byName.set(option.name, { option, fields: [fieldName] });
      }
    }
    return [...byName.values()];
  }, [fields]);

  const example = rows.find((r) => r.option.name === 'prefix') ?? rows[0];
  if (!example) return null;

  return (
    <section className="field-options" aria-labelledby="field-options">
      <h2 id="field-options">Field options</h2>
      <p className="muted">
        Set these on a dimension or measure&rsquo;s <code>inputs</code>, e.g.{' '}
        <code>{`measure({ name: 'revenue', inputs: { ${example.option.name}: … } })`}</code>.
      </p>
      <div className="field-options__scroll">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Option</th>
              <th>Type</th>
              <th>Read from</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ option, fields: on }) => (
              <tr key={option.name}>
                <td>
                  <code>{option.name}</code>
                </td>
                <td>
                  <code>{optionType(option)}</code>
                </td>
                <td>
                  <div className="prop-chips">
                    {on.map((f) => (
                      <code key={f} className="prop-chip">
                        {f}
                      </code>
                    ))}
                  </div>
                </td>
                <td>{optionDescription(option)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export const ChartPage = ({ entry, variantId }: { entry: ChartEntry; variantId?: string }) => {
  const variant = getVariant(entry, variantId);
  useDocumentTitle(`${variant?.name ?? entry.name} playground`, BRAND.name);
  const index = chartEntries.indexOf(entry);
  const prev = chartEntries[index - 1];
  const next = chartEntries[index + 1];

  return (
    <div className="container page">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <a href={href('/charts')}>Gallery</a>
        <span aria-hidden>/</span>
        <span>{entry.group}</span>
        <span aria-hidden>/</span>
        <span>Playground</span>
      </nav>
      <div className="page__head">
        <h1>{entry.name}</h1>
        <p className="lede">{variant?.description ?? entry.description}</p>
        <div className="docs-head__actions">
          <code className="badge">{`<${String(entry.exportName)} />`}</code>
          <a className="button button--small" href={`/docs/components/${entry.id}`}>
            Docs and examples
          </a>
        </div>
      </div>
      <Playground key={`${entry.id}/${variant?.id ?? ''}`} entry={entry} variantId={variant?.id} />
      <FieldOptions entry={entry} />
      <nav className="pager" aria-label="More charts">
        {prev ? <a href={href(`/charts/${prev.id}`)}>← {prev.name}</a> : <span />}
        {next && <a href={href(`/charts/${next.id}`)}>{next.name} →</a>}
      </nav>
    </div>
  );
};
