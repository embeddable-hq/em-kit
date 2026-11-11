import { IconAdjustments, IconCheck } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { componentDefaults } from "../../src/componentDefaults.generated";
import { CodeBlock } from "../components/CodeBlock";
import { CopyButton } from "../components/CopyButton";
import { DocsLayout, TocItem } from "../components/DocsLayout";
import { Markdown } from "../components/Markdown";
import { ChartContextBar } from "../components/Switchers";
import { useChart } from "../components/useChart";
import { ChartSettings } from "../catalog/build";
import { ChartEntry } from "../catalog/registry";
import { BRAND } from "../config";
import {
  builtIns,
  ComponentExample,
  componentExamples,
  componentMarkdown,
  componentPrompt,
  exampleCode,
  propDescription,
  propsOf,
} from "../docs/components";
import { useDocumentTitle } from "../router";
import { useCanvas, useSiteSettings } from "../state";
import { componentFieldOptions } from "../generated/props";
import { FieldOptions } from "./ChartPage";

const playgroundPath = (entry: ChartEntry, example: ComponentExample) =>
  `/charts/${entry.id}${example.variantId ? `/${example.variantId}` : ""}`;

// One example: a live preview and its code, with the actions a reader takes
// next. The preview follows the site-wide theme, language and dataset.
const ExampleCard = ({
  entry,
  example,
  hero,
}: {
  entry: ChartEntry;
  example: ComponentExample;
  hero?: boolean;
}) => {
  const { themeId, languageId, datasetId } = useSiteSettings();
  const canvas = useCanvas();
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const settings = useMemo<ChartSettings>(
    () => ({
      themeId,
      languageId,
      datasetId,
      dataState: example.dataState,
      variantId: example.variantId,
      overrides: example.overrides,
      toggles: {},
    }),
    [themeId, languageId, datasetId, example],
  );
  const { built, Component } = useChart(entry, settings);
  const code = () =>
    exampleCode(entry, example, { themeId, languageId, datasetId });

  return (
    <div className={`example${hero ? " example--hero" : ""}`}>
      <div className="example__bar">
        <div
          className="tabs tabs--small"
          role="tablist"
          aria-label={`${example.name} view`}
        >
          {(["preview", "code"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "is-active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "preview" ? "Preview" : "Code"}
            </button>
          ))}
        </div>
        {example.dataState === "ready" && (
          <div className="example__actions">
            <CopyButton
              kind="prompt"
              label="Copy prompt"
              title="Copy instructions for an AI coding assistant to add this chart to your app"
              getText={() => componentPrompt(entry, code(), example.name)}
            />
            <a
              className="button button--small"
              href={playgroundPath(entry, example)}
            >
              <IconAdjustments size={15} stroke={1.75} aria-hidden />
              Playground
            </a>
          </div>
        )}
      </div>
      {tab === "preview" ? (
        <div
          className={`example__canvas${canvas.dark ? " is-dark" : ""}`}
          style={{ background: canvas.background }}
        >
          <div style={{ height: hero ? 420 : 360 }}>
            <Component {...built.props} />
          </div>
        </div>
      ) : (
        <CodeBlock code={code()} maxHeight={hero ? 420 : 360} />
      )}
    </div>
  );
};

const defaultsFor = (entry: ChartEntry): Record<string, unknown> =>
  (componentDefaults as Record<string, Record<string, unknown>>)[
    String(entry.exportName)
  ] ?? {};

const PropsTable = ({ entry }: { entry: ChartEntry }) => {
  const props = propsOf(entry);
  const defaults = defaultsFor(entry);
  return (
    <div className="doc-table-scroll">
      <table className="doc-table props-table">
        <thead>
          <tr>
            <th>Prop</th>
            <th>Type</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {props.map((p) => (
            <tr key={p.name}>
              <td>
                <code>{p.name}</code>
                {p.required && (
                  <span className="props-table__required">required</span>
                )}
              </td>
              <td>
                <code className="props-table__type">{p.type}</code>
              </td>
              <td>
                {p.name in defaults ? (
                  <code>{JSON.stringify(defaults[p.name])}</code>
                ) : (
                  <span className="muted">–</span>
                )}
              </td>
              <td>{propDescription(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const ComponentDocPage = ({
  entry,
  route,
}: {
  entry: ChartEntry;
  route: string;
}) => {
  useDocumentTitle(entry.name, BRAND.name);
  const { themeId, languageId, datasetId } = useSiteSettings();
  const examples = componentExamples(entry);
  const [hero, ...rest] = examples;
  const items = builtIns(entry);
  const hasFieldOptions = Object.values(
    componentFieldOptions[String(entry.exportName)] ?? {},
  ).some((f) => f.inputs.length);

  const toc: TocItem[] = [
    { id: "installation", title: "Installation" },
    { id: "built-in", title: "What it does for you" },
    { id: "examples", title: "Examples" },
    ...rest.map((e) => ({ id: e.id, title: e.name, depth: 3 as const })),
    { id: "props", title: "Props" },
    ...(hasFieldOptions
      ? [{ id: "field-options", title: "Field options" }]
      : []),
  ];

  const base = { themeId, languageId, datasetId };
  const markdown = () =>
    componentMarkdown(
      entry,
      examples.map((example) => ({
        example,
        code: exampleCode(entry, example, base),
      })),
    );

  return (
    <DocsLayout route={route} toc={toc}>
      <header className="docs-head">
        <span className="docs-head__section">Components · {entry.group}</span>
        <h1>{entry.name}</h1>
        <p className="lede">{entry.description}</p>
        <div className="docs-head__actions">
          <code className="badge">{`<${String(entry.exportName)} />`}</code>
          <CopyButton
            kind="markdown"
            label="Copy Markdown"
            getText={markdown}
            title="Copy this page as Markdown, e.g. for an AI assistant"
          />
          <CopyButton
            kind="prompt"
            label="Copy prompt"
            title="Copy instructions for an AI coding assistant to add this chart to your app"
            getText={() =>
              componentPrompt(entry, exampleCode(entry, hero!, base))
            }
          />
        </div>
      </header>

      <div className="docs-context">
        <ChartContextBar compact />
      </div>
      <ExampleCard entry={entry} example={hero!} hero />

      <div className="docs-content">
        <h2 id="installation">Installation</h2>
        <CodeBlock
          code={`npm install ${BRAND.packageName}`}
          label="bash"
          compact
        />
        <Markdown>
          {`Then wrap your app, or the part with charts, in \`ChartsProvider\` once. See [Installation](/docs/installation).`}
        </Markdown>

        <h2 id="built-in">What it does for you</h2>
        <p>
          Everything below works with no code. With a chart library you would
          write it yourself, for every chart.{" "}
          <a href="/docs/why">See the full comparison</a>.
        </p>
        <ul className="built-in">
          {items.map((item) => (
            <li key={item}>
              <IconCheck size={16} stroke={2.5} aria-hidden />
              <Markdown>{item}</Markdown>
            </li>
          ))}
        </ul>

        <h2 id="examples">Examples</h2>
        <p>
          Each example is live and follows the theme, language and data set
          above. Copy its code, or copy a prompt that tells your AI coding
          assistant to add it to your app.
        </p>
        {rest.map((example) => (
          <section
            key={example.id}
            className="example-section"
            aria-labelledby={example.id}
          >
            <h3 id={example.id}>{example.name}</h3>
            <Markdown>{example.description}</Markdown>
            <ExampleCard entry={entry} example={example} />
          </section>
        ))}

        {entry.notes && entry.notes.length > 0 && (
          <div className="callout">
            <Markdown>{entry.notes.join("\n\n")}</Markdown>
          </div>
        )}

        <h2 id="props">Props</h2>
        <p>
          Generated from the component’s types. Defaults match the
          out-of-the-box look; every display prop is optional.
        </p>
        <PropsTable entry={entry} />

        <FieldOptions entry={entry} />
      </div>
    </DocsLayout>
  );
};
