import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { ComponentType, useMemo, useState } from 'react';
import { CodeBlock } from '../components/CodeBlock';
import { CopyButton } from '../components/CopyButton';
import { DocsLayout, TocItem } from '../components/DocsLayout';
import { Markdown } from '../components/Markdown';
import { datasets } from '../catalog/datasets';
import { BRAND } from '../config';
import {
  aiSchemaJson,
  comparisonRows,
  Guide,
  GuideBlock,
  guideMarkdown,
  headingId,
  kitChartCode,
  LiveBlockId,
  rawChartCode,
} from '../docs/guides';
import { TargetLineChart } from '../examples/TargetLineChart';
import { useDocumentTitle } from '../router';
import { useSiteSettings } from '../state';

const lines = (code: string) => code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length;

// The worked example from "Build your own chart", live on the site's dataset and theme.
const TargetLineDemo = () => {
  const { datasetId } = useSiteSettings();
  const ds = datasets[datasetId];
  const rows = ds.byTime('month');
  const target = useMemo(() => {
    const values = rows.map((r) => Number(r[ds.specs.primary.name] ?? 0));
    const mean = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
    return Math.round((mean * 1.05) / 1000) * 1000;
  }, [rows, ds]);
  return (
    <div className="build-demo">
      <TargetLineChart
        title={`${ds.specs.primary.title} against target`}
        description="Monthly, with a flat target line"
        xAxis={ds.time('month')}
        measure={ds.primary}
        results={{ isLoading: false, data: rows }}
        target={target}
      />
    </div>
  );
};

const AiSchema = () => {
  const [open, setOpen] = useState(false);
  return (
    <details className="ai-details" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        input_schema <span>pretty-printed, {(aiSchemaJson.length / 1024).toFixed(1)} KB. Click to expand</span>
      </summary>
      {open && <CodeBlock code={aiSchemaJson} label="renderChartTool.input_schema" maxHeight={440} />}
    </details>
  );
};

// The same production card twice: on a chart library, and on this one.
export const RawVsKit = () => (
  <div className="raw-vs-kit">
    <div className="raw-vs-kit__side">
      <div className="raw-vs-kit__head">
        <span className="raw-vs-kit__tag">With a chart library</span>
        <span className="muted">{lines(rawChartCode)} lines, and still no Excel or PNG export, translations or events</span>
      </div>
      <CodeBlock code={rawChartCode} label="react-chartjs-2" maxHeight={480} />
    </div>
    <div className="raw-vs-kit__side raw-vs-kit__side--kit">
      <div className="raw-vs-kit__head">
        <span className="raw-vs-kit__tag raw-vs-kit__tag--kit">With {BRAND.name}</span>
        <span className="muted">{lines(kitChartCode)} lines</span>
      </div>
      <CodeBlock code={kitChartCode} label={BRAND.packageName} />
      <ul className="raw-vs-kit__extras">
        {[
          'Currency formatted in the reader’s locale',
          'The same colour per region as every other chart',
          'Loading, empty and error states',
          'CSV, Excel and PNG export, and a maximize view',
          'Tooltips formatted like the axes',
          'Translated titles, fields and values',
          'Typed click events',
        ].map((item) => (
          <li key={item}>
            <IconCheck size={15} stroke={2.5} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export const ComparisonTable = () => (
  <div className="doc-table-scroll">
    <table className="doc-table comparison-table">
      <thead>
        <tr>
          <th>What a dashboard needs</th>
          <th>With a chart library</th>
          <th>With {BRAND.name}</th>
        </tr>
      </thead>
      <tbody>
        {comparisonRows.map((row) => (
          <tr key={row.need}>
            <td>{row.need}</td>
            <td className="comparison-table__library">{row.library}</td>
            <td className="comparison-table__kit">
              <IconCheck size={15} stroke={2.5} aria-hidden />
              {row.kit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const NextSteps = () => (
  <div className="next-steps">
    {[
      { title: `Why ${BRAND.name}`, text: 'What a chart library leaves to you', path: '/docs/why' },
      { title: 'Quick start', text: 'Your first chart in five minutes', path: '/docs/quick-start' },
      { title: 'Components', text: 'Every chart, with examples and props', path: '/docs/components' },
      { title: 'Use with AI', text: 'Let a model choose the chart', path: '/docs/ai' },
    ].map((card) => (
      <a key={card.path} href={card.path} className="next-steps__card">
        <strong>{card.title}</strong>
        <span>{card.text}</span>
        <IconArrowRight size={16} aria-hidden />
      </a>
    ))}
  </div>
);

const live: Record<LiveBlockId, ComponentType> = {
  'target-line-demo': TargetLineDemo,
  'ai-schema': AiSchema,
  'raw-vs-kit': RawVsKit,
  comparison: ComparisonTable,
  'next-steps': NextSteps,
  'component-index': () => null,
};

const Block = ({ block }: { block: GuideBlock }) => {
  if ('h2' in block) return <h2 id={headingId(block)}>{block.h2}</h2>;
  if ('h3' in block) return <h3>{block.h3}</h3>;
  if ('live' in block) {
    const Live = live[block.live];
    return <Live />;
  }
  if ('code' in block) {
    return <CodeBlock code={block.code} label={block.label} plain={block.plain} maxHeight={block.maxHeight} />;
  }
  return <Markdown>{block.md}</Markdown>;
};

export const DocPage = ({ guide, route }: { guide: Guide; route: string }) => {
  useDocumentTitle(guide.title, BRAND.name);
  const toc: TocItem[] = guide.blocks
    .filter((b): b is { h2: string; id?: string } => 'h2' in b)
    .map((b) => ({ id: headingId(b), title: b.h2 }));

  return (
    <DocsLayout route={route} toc={toc}>
      <header className="docs-head">
        <span className="docs-head__section">{guide.section}</span>
        <h1>{guide.title}</h1>
        <p className="lede">{guide.description}</p>
        <div className="docs-head__actions">
          <CopyButton kind="markdown" label="Copy Markdown" getText={() => guideMarkdown(guide)} title="Copy this page as Markdown, e.g. for an AI assistant" />
        </div>
      </header>
      <div className="docs-content">
        {guide.blocks.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>
    </DocsLayout>
  );
};
